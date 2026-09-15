"""Membership plans and subscription API."""
from datetime import datetime, timedelta

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from ..extensions import db
from ..models import MembershipOrder, MembershipPlan, User, UserMembership

bp = Blueprint("memberships", __name__)


def _active_membership(user_id: int) -> UserMembership | None:
    return UserMembership.query.filter_by(
        user_id=user_id, status="active"
    ).filter(
        (UserMembership.expires_at == None) | (UserMembership.expires_at > datetime.utcnow())
    ).first()


@bp.get("/plans")
def list_plans():
    plans = MembershipPlan.query.filter_by(is_active=True).order_by(MembershipPlan.sort_order).all()
    import json
    return jsonify([{
        "id": p.id,
        "slug": p.slug,
        "name": p.name,
        "description": p.description,
        "price_monthly": float(p.price_monthly),
        "price_yearly": float(p.price_yearly),
        "features": json.loads(p.features) if p.features else [],
    } for p in plans])


@bp.get("/me")
@jwt_required()
def my_membership():
    user_id = int(get_jwt_identity())
    membership = _active_membership(user_id)
    if membership is None:
        free_plan = MembershipPlan.query.filter_by(slug="free").first()
        return jsonify({
            "status": "free",
            "plan": {"slug": "free", "name": "Free"} if free_plan else None,
            "expires_at": None,
        })
    return jsonify({
        "status": membership.status,
        "billing_cycle": membership.billing_cycle,
        "starts_at": membership.starts_at.isoformat(),
        "expires_at": membership.expires_at.isoformat() if membership.expires_at else None,
        "plan": {
            "id": membership.plan.id,
            "slug": membership.plan.slug,
            "name": membership.plan.name,
        },
    })


@bp.post("/subscribe")
@jwt_required()
def subscribe():
    """
    Initiate a subscription. In production this would redirect to a payment
    provider; here it immediately activates the membership (demo / sandbox mode).
    """
    user_id = int(get_jwt_identity())
    data = request.get_json(silent=True) or {}
    plan_slug = str(data.get("plan_slug", "")).strip()
    billing_cycle = str(data.get("billing_cycle", "monthly")).strip()

    if billing_cycle not in ("monthly", "yearly"):
        return jsonify({"error": "billing_cycle must be 'monthly' or 'yearly'"}), 400

    plan = MembershipPlan.query.filter_by(slug=plan_slug, is_active=True).first()
    if plan is None:
        return jsonify({"error": "Plan not found"}), 404

    if plan.slug == "free":
        return jsonify({"error": "Cannot subscribe to the free plan"}), 400

    # Cancel any existing active memberships
    existing = _active_membership(user_id)
    if existing:
        existing.status = "cancelled"
        existing.cancelled_at = datetime.utcnow()

    amount = float(plan.price_yearly if billing_cycle == "yearly" else plan.price_monthly)
    duration_days = 365 if billing_cycle == "yearly" else 31
    now = datetime.utcnow()

    membership = UserMembership(
        user_id=user_id,
        plan_id=plan.id,
        status="active",
        billing_cycle=billing_cycle,
        starts_at=now,
        expires_at=now + timedelta(days=duration_days),
    )
    db.session.add(membership)
    db.session.flush()  # get membership.id

    order = MembershipOrder(
        user_id=user_id,
        membership_id=membership.id,
        plan_id=plan.id,
        amount=amount,
        currency="EUR",
        billing_cycle=billing_cycle,
        status="paid",
        payment_provider="sandbox",
        paid_at=now,
    )
    db.session.add(order)
    db.session.commit()

    return jsonify({
        "ok": True,
        "membership": {
            "status": membership.status,
            "plan": plan.slug,
            "billing_cycle": billing_cycle,
            "expires_at": membership.expires_at.isoformat(),
        },
    }), 201


@bp.post("/cancel")
@jwt_required()
def cancel():
    user_id = int(get_jwt_identity())
    membership = _active_membership(user_id)
    if membership is None:
        return jsonify({"error": "No active membership to cancel"}), 404

    membership.status = "cancelled"
    membership.cancelled_at = datetime.utcnow()
    db.session.commit()
    return jsonify({"ok": True, "message": "Membership cancelled. Access continues until expiry."})

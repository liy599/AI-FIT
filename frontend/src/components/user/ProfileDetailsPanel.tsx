import type { RefObject } from 'react'
import type { ProfileEditState, UserProfile } from '../../modules/user/profileTypes'

type ProfileDetailsPanelProps = {
  profile: UserProfile | null
  edit: ProfileEditState | null
  isEditing: boolean
  avatarUploading: boolean
  fileInputRef: RefObject<HTMLInputElement>
  defaultAvatarImage: string
  resolveAvatarUrl: (url: string | null | undefined) => string | null
  onEditChange: (next: ProfileEditState) => void
  onEditingChange: (next: boolean) => void
  onPickAvatar: (file: File) => void
  onSave: () => void
}

export function ProfileDetailsPanel(props: ProfileDetailsPanelProps) {
  const {
    profile,
    edit,
    isEditing,
    avatarUploading,
    fileInputRef,
    defaultAvatarImage,
    resolveAvatarUrl,
    onEditChange,
    onEditingChange,
    onPickAvatar,
    onSave
  } = props

  return (
    <div className="profile-panel">
      <div className="text-sm font-semibold">Profile</div>
      {!profile || !edit ? (
        <div className="mt-3 text-sm text-slate-600">Loading...</div>
      ) : isEditing ? (
        <div className="mt-4 profile-edit-grid">
          <div className="profile-edit-header-row">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                <img
                  src={resolveAvatarUrl(profile.avatar_url) ?? defaultAvatarImage}
                  className="h-full w-full object-cover"
                  alt={`${profile.username} avatar`}
                />
              </div>
              <div className="text-sm">
                <div className="font-medium">{profile.username}</div>
                <div className="text-xs text-slate-600">{profile.email}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="profile-btn-secondary disabled:opacity-50"
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? 'Uploading...' : 'Change avatar'}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  e.target.value = ''
                  if (!f) return
                  onPickAvatar(f)
                }}
              />
            </div>
          </div>

          <input
            className="profile-input"
            placeholder="Username"
            value={edit.username}
            onChange={(e) => onEditChange({ ...edit, username: e.target.value })}
          />
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            value={edit.gender}
            onChange={(e) => onEditChange({ ...edit, gender: e.target.value })}
          >
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
          <input
            className="profile-input"
            placeholder="Height (cm)"
            value={edit.height}
            onChange={(e) => onEditChange({ ...edit, height: e.target.value })}
          />
          <input
            className="profile-input"
            placeholder="Weight (kg)"
            value={edit.weight}
            onChange={(e) => onEditChange({ ...edit, weight: e.target.value })}
          />
          <select
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-600/10"
            value={edit.fitness_goal}
            onChange={(e) => onEditChange({ ...edit, fitness_goal: e.target.value })}
          >
            <option value="">Select a fitness goal</option>
            <option value="Build Muscle">Build Muscle</option>
            <option value="Lose Fat">Lose Fat</option>
            <option value="Stay Healthy">Stay Healthy</option>
          </select>

          <div className="profile-edit-actions-row">
            <button
              className="w-full rounded-xl border border-slate-200 bg-white px-6 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:w-auto"
              onClick={() => {
                onEditingChange(false)
                onEditChange({
                  username: profile.username,
                  gender: profile.gender ?? '',
                  height: profile.height != null ? String(profile.height) : '',
                  weight: profile.weight != null ? String(profile.weight) : '',
                  fitness_goal: profile.fitness_goal ?? ''
                })
              }}
            >
              Cancel
            </button>
            <button
              className="w-full rounded-xl bg-emerald-600 px-6 py-2 text-sm font-medium text-white hover:bg-emerald-500 sm:w-auto"
              onClick={onSave}
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 overflow-hidden rounded-full border border-slate-200 bg-slate-50">
                <img
                  src={resolveAvatarUrl(profile.avatar_url) ?? defaultAvatarImage}
                  className="h-full w-full object-cover"
                  alt={`${profile.username} avatar`}
                />
              </div>
              <div className="text-sm">
                <div className="font-medium">{profile.username}</div>
                <div className="text-xs text-slate-600">{profile.email}</div>
              </div>
            </div>
            <button
              className="profile-btn-primary"
              onClick={() => {
                onEditChange({
                  username: profile.username,
                  gender: profile.gender ?? '',
                  height: profile.height != null ? String(profile.height) : '',
                  weight: profile.weight != null ? String(profile.weight) : '',
                  fitness_goal: profile.fitness_goal ?? ''
                })
                onEditingChange(true)
              }}
            >
              Edit profile
            </button>
          </div>

          <div className="profile-meta-grid profile-subpanel">
            <div className="text-sm">
              <div className="text-xs text-slate-600">Gender</div>
              <div className="mt-1 font-medium">{profile.gender || '-'}</div>
            </div>
            <div className="text-sm">
              <div className="text-xs text-slate-600">Fitness Goal</div>
              <div className="mt-1 font-medium">{profile.fitness_goal || '-'}</div>
            </div>
            <div className="text-sm">
              <div className="text-xs text-slate-600">Height (cm)</div>
              <div className="mt-1 font-medium">{profile.height == null ? '-' : profile.height}</div>
            </div>
            <div className="text-sm">
              <div className="text-xs text-slate-600">Weight (kg)</div>
              <div className="mt-1 font-medium">{profile.weight == null ? '-' : profile.weight}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

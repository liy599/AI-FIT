const endpointGroups = ['/api/food', '/api/foods', '/api/meals', '/api/recognize']

const nextSteps = [
  'Phase 2: migrate `foods / meal_records / meal_items` data models and production APIs.',
  'Phase 3: rebuild the dashboard and meal editor with the main site style.',
  'Phase 4: remove runtime dependency on the `foodidentity` directory.'
]

export default function FoodModulePlaceholder() {
  return (
    <div className="cl_blog-widget">
      <h4 className="cl_blog-widget-title mb-20">Food Module Migration</h4>
      <p style={{ marginBottom: 16 }}>
        This page is the landing entry for the production food module in the main project. Phase 1 established ownership, API namespaces, and type scaffolding.
        Next, we will gradually migrate the core capabilities from `foodidentity` into this module.
      </p>

      <div style={{ marginBottom: 18 }}>
        <h6 className="sub-title mb-10">Current Scope</h6>
        <ul>
          <li>Frontend: `frontend/src/pages|components|lib/food`</li>
          <li>Backend: `backend/app/routes/food.py` and `backend/app/services/food/`</li>
          <li>The legacy page `/tools/food` remains temporarily for reference only</li>
        </ul>
      </div>

      <div style={{ marginBottom: 18 }}>
        <h6 className="sub-title mb-10">Target API Namespaces</h6>
        <ul>
          {endpointGroups.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      <div>
        <h6 className="sub-title mb-10">Next Steps</h6>
        <ul>
          {nextSteps.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

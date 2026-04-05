const endpointGroups = ['/api/food', '/api/foods', '/api/meals', '/api/recognize']

const nextSteps = [
  '第二阶段迁移 `foods / meal_records / meal_items` 数据模型与正式 API。',
  '第三阶段按主站风格重做首页总览页和餐次编辑页。',
  '第四阶段收口并移除对 `foodidentity` 目录的运行时依赖。'
]

export default function FoodModulePlaceholder() {
  return (
    <div className="cl_blog-widget">
      <h4 className="cl_blog-widget-title mb-20">Food Module Migration</h4>
      <p style={{ marginBottom: 16 }}>
        当前页面是正式 food 模块的主项目落位入口。第一阶段已完成目录归属、接口命名空间和类型骨架，
        下一步将把 `foodidentity` 的正式业务能力逐步迁入这里。
      </p>

      <div style={{ marginBottom: 18 }}>
        <h6 className="sub-title mb-10">Current Scope</h6>
        <ul>
          <li>前端正式目录：`frontend/src/pages|components|lib/food`</li>
          <li>后端正式目录：`backend/app/routes/food.py` 与 `backend/app/services/food/`</li>
          <li>当前旧页面 `/tools/food` 仍保留，仅作为过渡参考，不视为正式模块</li>
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


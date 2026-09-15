import { REFERENCES } from "../data/references";
import { MODULES } from "../data/moduleContent";

export function AboutPage() {
  return (
    <div className="page">
      <p className="kicker">ABOUT / REFERENCES</p>
      <h1>形态系统 05</h1>
      <p>{MODULES.index.thesisZh}</p>
      <p>
        本应用是教学与生成艺术实验室。遗传模块为概念模拟，不提供医疗建议，也不输出临床预测。
      </p>
      <h3>使用路径</h3>
      <p>观察 → 拆解规则 → 扰动系统 → 阅读解释 → 保存配方。每个实验室含 LEARN / EXPERIMENT / ANALYZE。</p>
      <h3>进一步阅读（结构化摘要）</h3>
      {REFERENCES.map((r) => (
        <section key={r.id}>
          <h2>{r.titleZh}</h2>
          <ul>
            {r.points.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="muted">研究全文未在运行时解析；界面只使用 src/data 中的短文本。</p>
    </div>
  );
}

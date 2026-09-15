export function ViewPanel({ zoom, onReset }: { zoom: number; onReset: () => void }) {
  return (
    <>
      <h3>VIEW</h3>
      <p className="muted">滚轮缩放 · Alt / 中键拖移。空格截取画面（最多 4 张）。提高参数后形态向画面外延申，不强制装回视口。</p>
      <div className="seg">
        <button type="button" onClick={onReset}>
          RESET VIEW
        </button>
        <span className="muted">{Math.round(zoom * 100)}%</span>
      </div>
    </>
  );
}

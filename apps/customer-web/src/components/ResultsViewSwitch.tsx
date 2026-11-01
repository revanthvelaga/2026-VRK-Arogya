// "Needs attention / All results" segmented switch used on Insights.
export type ResultsView = 'attention' | 'all';

export function ResultsViewSwitch({
  value,
  onChange,
  attention,
  total,
}: {
  value: ResultsView;
  onChange: (v: ResultsView) => void;
  attention: number;
  total: number;
}) {
  return (
    <div className="results-switch" role="tablist" aria-label="Which results to show">
      <span className={`results-switch-thumb${value === 'all' ? ' right' : ''}`} aria-hidden />
      <button type="button" role="tab" aria-selected={value === 'attention'} className={value === 'attention' ? 'on' : ''} onClick={() => onChange('attention')}>
        Needs attention <b className="rs-count warn">{attention}</b>
      </button>
      <button type="button" role="tab" aria-selected={value === 'all'} className={value === 'all' ? 'on' : ''} onClick={() => onChange('all')}>
        All results <b className="rs-count">{total}</b>
      </button>
    </div>
  );
}

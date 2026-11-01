// Grey placeholder shapes in the layout that's about to load, with a slow
// shimmer — on a village 3G connection the page feels like it's arriving
// rather than stuck. Screen readers get a single "Loading…" instead.
export function CardSkeletons({ count = 3, layout = 'grid' }: { count?: number; layout?: 'grid' | 'carousel' }) {
  return (
    <div className={layout === 'carousel' ? 'carousel' : 'catalog-grid'} role="status" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div className={`rich-card skeleton-card${layout === 'carousel' ? ' carousel-card' : ''}`} key={i} aria-hidden="true">
          <div className="skeleton skeleton-art" />
          <div className="skeleton-body">
            <div className="skeleton skeleton-line" style={{ width: '78%' }} />
            <div className="skeleton skeleton-line skeleton-line--thin" style={{ width: '45%' }} />
            <div className="skeleton-foot">
              <div className="skeleton skeleton-line" style={{ width: '32%' }} />
              <div className="skeleton skeleton-pill" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowSkeletons({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="skeleton-rows">
      {Array.from({ length: count }, (_, i) => (
        <div className="card skeleton-row" key={i} aria-hidden="true">
          <div className="skeleton skeleton-line" style={{ width: '55%' }} />
          <div className="skeleton skeleton-line skeleton-line--thin" style={{ width: '35%' }} />
        </div>
      ))}
    </div>
  );
}

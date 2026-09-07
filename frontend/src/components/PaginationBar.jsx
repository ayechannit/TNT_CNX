const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function getPageList(page, totalPages) {
  const pages = [];
  const windowSize = 1; // pages shown on each side of current

  const addRange = (from, to) => {
    for (let i = from; i <= to; i++) pages.push(i);
  };

  if (totalPages <= 7) {
    addRange(1, totalPages);
    return pages;
  }

  pages.push(1);
  const start = Math.max(2, page - windowSize);
  const end = Math.min(totalPages - 1, page + windowSize);

  if (start > 2) pages.push("...");
  addRange(start, end);
  if (end < totalPages - 1) pages.push("...");
  pages.push(totalPages);

  return pages;
}

export default function PaginationBar({ page, totalPages, total, pageSize, onPageChange, onPageSizeChange }) {
  const pageList = getPageList(page, totalPages);

  return (
    <div className="pagination">
      <button
        className="pagination-nav"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Previous page"
      >
        &#8249; Prev
      </button>
      {pageList.map((p, i) =>
        p === "..." ? (
          <span key={`ellipsis-${i}`} className="page-ellipsis">...</span>
        ) : (
          <button
            key={p}
            className={p === page ? "page-number active" : "page-number"}
            onClick={() => onPageChange(p)}
            disabled={p === page}
          >
            {p}
          </button>
        )
      )}
      <button
        className="pagination-nav"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Next page"
      >
        Next &#8250;
      </button>
      <span className="pagination-total">({total} items)</span>
      <label className="page-size-label">
        Show
        <select value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        per page
      </label>
    </div>
  );
}

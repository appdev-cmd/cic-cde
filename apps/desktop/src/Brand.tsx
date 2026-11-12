export function BrandMark() {
  return <img className="brand-mark" src="/cic-cde-mark.svg" alt="" width={32} height={32} />;
}

export default function Brand() {
  return (
    <span className="brand-lockup" role="img" aria-label="CIC CDE">
      <BrandMark />
      <svg className="brand-wordmark" viewBox="0 0 106 22" aria-hidden="true">
        <g fill="none" strokeWidth="2.8" strokeLinejoin="bevel">
          <path
            stroke="#10243b"
            d="M17 4H7L3 8v6l4 4h10M23 4v14M43 4H33l-4 4v6l4 4h10"
          />
          <path
            stroke="#1760a8"
            d="M66 4H56l-4 4v6l4 4h10M72 4h9l4 4v6l-4 4h-9ZM103 4H91v14h12M91 11h10"
          />
        </g>
      </svg>
    </span>
  );
}

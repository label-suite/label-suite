// Embeds a design/prototype/ page in a spec as a wireframe.
// Usage in MDX:
//   import PrototypeFrame from '@notes/components/prototype-frame';
//   <PrototypeFrame page="admin/user-management" caption="使用者管理" client:idle />
// The page is served by `pnpm prototype` (scripts/serve-prototype.mjs). When that
// server is not running, the frame is replaced by a notice; the source path under
// the frame always tells the reader which file to open.
// A prototype picks its layout from the iframe's own width, so a narrow note column
// would switch it to the mobile layout. Below MIN_FRAME_WIDTH the iframe keeps that
// width and is scaled down to fit, which keeps the desktop layout.
import { useEffect, useRef, useState } from 'react';

const PROTOTYPE_ORIGIN = 'http://127.0.0.1:4331';
/** Just above the prototype's 767px mobile breakpoint, to keep the scale-down small. */
const MIN_FRAME_WIDTH = 800;
const BORDER_WIDTH = 1;

type Props = {
  /** Page path under design/prototype/pages/, without the .html extension. */
  page: string;
  /** Short page name, used as the iframe title and the caption. */
  caption: string;
  /** Displayed frame height in pixels. */
  height?: number;
};

type Status = 'checking' | 'up' | 'down';

export default function PrototypeFrame({ page, caption, height = 640 }: Props) {
  const url = `${PROTOTYPE_ORIGIN}/pages/${page}.html`;
  const source = `design/prototype/pages/${page}.html`;
  const [status, setStatus] = useState<Status>('checking');
  const [figureWidth, setFigureWidth] = useState(0);
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // An iframe fires load even when the connection is refused, so probe first.
    // no-cors resolves with an opaque response when the server answers and
    // rejects only on a network error.
    let active = true;
    fetch(url, { mode: 'no-cors', cache: 'no-store' })
      .then(() => active && setStatus('up'))
      .catch(() => active && setStatus('down'));
    return () => {
      active = false;
    };
  }, [url]);

  useEffect(() => {
    const figure = figureRef.current;
    if (!figure) return;
    const observer = new ResizeObserver(([entry]) => setFigureWidth(entry.contentRect.width));
    observer.observe(figure);
    return () => observer.disconnect();
  }, []);

  const box = {
    boxSizing: 'border-box' as const,
    width: '100%',
    height: `${height}px`,
    border: `${BORDER_WIDTH}px solid #d4d4d8`,
    borderRadius: '8px',
  };
  const innerWidth = figureWidth - BORDER_WIDTH * 2;
  const innerHeight = height - BORDER_WIDTH * 2;
  const scale = innerWidth > 0 && innerWidth < MIN_FRAME_WIDTH ? innerWidth / MIN_FRAME_WIDTH : 1;
  const frame = {
    display: 'block',
    border: 0,
    width: scale < 1 ? `${MIN_FRAME_WIDTH}px` : '100%',
    height: `${innerHeight / scale}px`,
    transform: scale < 1 ? `scale(${scale})` : undefined,
    transformOrigin: 'top left',
  };

  return (
    <figure ref={figureRef} style={{ margin: '1rem 0' }}>
      {status === 'up' ? (
        <div style={{ ...box, overflow: 'hidden' }}>
          <iframe src={url} title={`${caption} prototype`} loading="lazy" style={frame} />
        </div>
      ) : (
        <div
          role="note"
          style={{ ...box, height: '120px', display: 'grid', placeItems: 'center', color: '#71717a', textAlign: 'center' }}
        >
          {status === 'checking'
            ? '載入 prototype…'
            : '未啟動 prototype 伺服器。執行 pnpm prototype 後重新整理即可檢視。'}
        </div>
      )}
      <figcaption style={{ marginTop: '0.5rem', fontSize: '0.875rem', color: '#71717a' }}>
        {caption}，原始檔：<code>{source}</code>
      </figcaption>
    </figure>
  );
}

import { RichTextNode } from "@/lib/mock-document";

function normalizeExternalHref(rawHref: unknown) {
  const href = String(rawHref ?? "").trim();
  if (!href) {
    return "";
  }

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(href)) {
    return `https://${href}`;
  }

  return "";
}

function renderInline(nodes: RichTextNode[] | undefined) {
  if (!nodes) {
    return null;
  }

  return nodes.map((node, index) => {
    if (node.type !== "text") {
      return <span key={index}>{node.text}</span>;
    }

    let className = "";
    if (node.marks?.some((mark) => mark.type === "bold")) {
      className += " font-semibold";
    }
    if (node.marks?.some((mark) => mark.type === "italic")) {
      className += " italic";
    }

    return (
      <span key={index} className={className.trim()}>
        {node.text}
      </span>
    );
  });
}

function inlineText(nodes: RichTextNode[] | undefined): string {
  if (!nodes) {
    return "";
  }

  return nodes
    .map((node) => {
      if (typeof node.text === "string") {
        return node.text;
      }
      return inlineText(node.content);
    })
    .join("")
    .trim();
}

function headingClassName(level: number) {
  if (level === 1) {
    return "text-3xl font-semibold tracking-tight text-slate-950";
  }
  if (level === 2) {
    return "text-[1.75rem] font-semibold tracking-tight text-slate-900";
  }
  if (level === 3) {
    return "text-[1.45rem] font-semibold tracking-tight text-slate-900";
  }
  if (level === 4) {
    return "text-[1.2rem] font-semibold text-slate-900";
  }
  if (level === 5) {
    return "text-[1.05rem] font-semibold text-slate-800";
  }
  return "text-base font-semibold text-slate-800";
}

export function DocumentRenderer({ content }: { content: RichTextNode[] }) {
  return (
    <div className="space-y-1">
      {content.map((node, index) => {
        if (node.type === "heading") {
          if (node.attrs?.preservedEmpty && !inlineText(node.content)) {
            return null;
          }

          const level = Math.max(1, Math.min(6, Number(node.attrs?.level ?? 1)));
          const className = headingClassName(level);
          return (
            <h2 key={index} id={String(node.attrs?.anchor ?? "")} className={className}>
              {renderInline(node.content)}
            </h2>
          );
        }

        if (node.type === "paragraph") {
          if (node.attrs?.preservedEmpty && !inlineText(node.content)) {
            return null;
          }

          return (
            <p key={index} className="text-base leading-8 text-slate-700">
              {renderInline(node.content)}
            </p>
          );
        }

        if (node.type === "bullet_list") {
          if (node.attrs?.preservedEmpty) {
            return null;
          }

          return (
            <ul key={index} className="list-disc space-y-1 pl-6 text-base leading-8 text-slate-700">
              {node.content?.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item.content)}</li>
              ))}
            </ul>
          );
        }

        if (node.type === "ordered_list") {
          if (node.attrs?.preservedEmpty) {
            return null;
          }

          return (
            <ol key={index} className="list-decimal space-y-1 pl-6 text-base leading-8 text-slate-700">
              {node.content?.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInline(item.content)}</li>
              ))}
            </ol>
          );
        }

        if (node.type === "check_list") {
          if (node.attrs?.preservedEmpty) {
            return null;
          }

          return (
            <div key={index} className="space-y-1">
              {node.content?.map((item, itemIndex) => (
                <label key={itemIndex} className="flex items-start gap-3 text-base leading-8 text-slate-700">
                  <input
                    type="checkbox"
                    checked={Boolean(item.attrs?.checked)}
                    readOnly
                    className="mt-2 h-4 w-4 rounded border-slate-300 text-sky-500"
                  />
                  <span>{renderInline(item.content)}</span>
                </label>
              ))}
            </div>
          );
        }

        if (node.type === "horizontal_rule") {
          return <hr key={index} className="my-1 border-0 border-t border-slate-200" />;
        }

        if (node.type === "link_card") {
          if (node.attrs?.preservedEmpty) {
            return null;
          }

          const normalizedHref = normalizeExternalHref(node.attrs?.href);
          const title = String(node.attrs?.title ?? "未命名链接");
          const hrefLabel = normalizedHref || String(node.attrs?.href ?? "");

          if (!normalizedHref) {
            return (
              <p key={index} className="text-base leading-8 text-slate-700">
                {title}
              </p>
            );
          }

          return (
            <a
              key={index}
              href={normalizedHref}
              target="_blank"
              rel="noreferrer"
              className="block py-0.5 text-slate-700 transition hover:text-slate-900"
            >
              <div className="text-base leading-8 text-slate-800">{title}</div>
              <div className="text-sm leading-6 text-slate-400">{normalizedHref}</div>
            </a>
          );
        }

        if (node.type === "image_block") {
          if (node.attrs?.preservedEmpty) {
            return null;
          }

          const src = String(node.attrs?.src ?? "");
          const alt = String(node.attrs?.alt ?? "图片");
          return (
            <figure key={index} className="py-1">
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={alt} className="max-h-[420px] w-full rounded-lg object-cover" />
              ) : (
                <div className="flex h-40 items-center justify-center text-sm text-slate-400">未提供图片地址</div>
              )}
              <figcaption className="mt-2 text-sm leading-6 text-slate-500">{alt}</figcaption>
            </figure>
          );
        }

        if (node.type === "blockquote") {
          if (node.attrs?.preservedEmpty && !inlineText(node.content)) {
            return null;
          }

          return (
            <blockquote
              key={index}
              className="border-l-2 border-slate-300 pl-4 text-base leading-8 text-slate-600"
            >
              {renderInline(node.content)}
            </blockquote>
          );
        }

        if (node.type === "code_block") {
          if (node.attrs?.preservedEmpty && !inlineText(node.content)) {
            return null;
          }

          return (
            <pre
              key={index}
              className="overflow-x-auto rounded-2xl bg-ink px-5 py-4 text-sm leading-7 text-slate-100"
            >
              <code>{node.content?.[0]?.text}</code>
            </pre>
          );
        }

        return null;
      })}
    </div>
  );
}

export function ApiUnavailableNotice({
  message = "后端接口当前不可用，页面暂时无法加载最新数据。请检查 API 服务状态后刷新重试。",
}: {
  message?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      {message}
    </div>
  );
}

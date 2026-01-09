import CapturePage from "../../../components/CapturePage";

export default function Page({
  params,
}: {
  params: { id: string };
}) {
  return <CapturePage sessionId={params.id} />;
}

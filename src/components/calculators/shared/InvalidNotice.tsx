import { Card } from "@/components/ui/Card";

/** Shown in place of results while any input is invalid. */
export function InvalidNotice({
  children = "Check the highlighted fields to see your result.",
}: {
  children?: string;
}) {
  return (
    <Card role="alert" className="text-danger font-medium">
      {children}
    </Card>
  );
}

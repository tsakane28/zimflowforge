import { defineMcp } from "@lovable.dev/mcp-js";
import listPublicationsTool from "./tools/list-publications";
import getLatestPublicationTool from "./tools/get-latest-publication";

export default defineMcp({
  name: "zw-fx-workbench-mcp",
  title: "Zimbabwe FX Operations Workbench",
  version: "0.1.0",
  instructions:
    "Tools for the Reserve Bank of Zimbabwe (RBZ) daily interbank exchange-rate publications. Use `list_rbz_publications` to enumerate every PDF published in a given month, and `get_latest_rbz_publication` to resolve the most recent PDF on or before a date (weekends automatically skipped). Both tools return direct PDF URLs you can fetch or link to.",
  tools: [listPublicationsTool, getLatestPublicationTool],
});

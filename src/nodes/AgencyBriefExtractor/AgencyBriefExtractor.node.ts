import {
  type IExecuteFunctions,
  type INodeExecutionData,
  type INodeType,
  type INodeTypeDescription,
  type NodeConnectionType,
  NodeOperationError,
} from "n8n-workflow";
import { AnthropicBriefLLM } from "../../llm";
import { extractBrief } from "../../extract";

/**
 * n8n community node: turns an inbound transcript/thread into a
 * schema-validated delivery brief using Claude with a validate+repair loop.
 *
 * This is the thin n8n edge over the typed `extractBrief` core — the reliability
 * lives in the library, the node just wires it into a workflow.
 */
export class AgencyBriefExtractor implements INodeType {
  description: INodeTypeDescription = {
    displayName: "Agency Brief Extractor",
    name: "agencyBriefExtractor",
    icon: "fa:clipboard-list",
    group: ["transform"],
    version: 1,
    subtitle: '={{ $parameter["client"] }}',
    description:
      "Turn a meeting transcript or Slack thread into a schema-validated delivery brief (Claude, with validate + repair).",
    defaults: { name: "Agency Brief Extractor" },
    inputs: ["main"] as NodeConnectionType[],
    outputs: ["main"] as NodeConnectionType[],
    credentials: [{ name: "agencyOsApi", required: true }],
    properties: [
      {
        displayName: "Transcript Field",
        name: "transcriptField",
        type: "string",
        default: "text",
        description: "Name of the incoming JSON field that holds the transcript / thread text.",
      },
      {
        displayName: "Client Hint",
        name: "client",
        type: "string",
        default: "",
        description: "Optional client / account hint passed to the extractor.",
      },
      {
        displayName: "Max Repair Attempts",
        name: "maxAttempts",
        type: "number",
        typeOptions: { minValue: 1, maxValue: 6 },
        default: 3,
        description: "How many times to re-ask Claude with validation errors before failing the item.",
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const out: INodeExecutionData[] = [];

    const creds = await this.getCredentials("agencyOsApi");
    const llm = new AnthropicBriefLLM({
      apiKey: creds.anthropicApiKey as string,
      model: (creds.model as string) || undefined,
    });

    for (let i = 0; i < items.length; i += 1) {
      const transcriptField = this.getNodeParameter("transcriptField", i) as string;
      const client = this.getNodeParameter("client", i) as string;
      const maxAttempts = this.getNodeParameter("maxAttempts", i) as number;

      const text = (items[i].json?.[transcriptField] as string | undefined) ?? "";
      if (!text) {
        throw new NodeOperationError(
          this.getNode(),
          `No transcript text found in field "${transcriptField}"`,
          { itemIndex: i },
        );
      }

      const { brief, attempts } = await extractBrief(llm, text, {
        client: client || undefined,
        maxAttempts,
      });
      out.push({ json: { brief, attempts }, pairedItem: { item: i } });
    }

    return [out];
  }
}

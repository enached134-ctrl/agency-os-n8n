import type { ICredentialType, INodeProperties } from "n8n-workflow";

export class AgencyOsApi implements ICredentialType {
  name = "agencyOsApi";

  displayName = "Agency OS API";

  documentationUrl = "https://github.com/enached134-ctrl/agency-os-n8n";

  properties: INodeProperties[] = [
    {
      displayName: "Anthropic API Key",
      name: "anthropicApiKey",
      type: "string",
      typeOptions: { password: true },
      default: "",
      required: true,
    },
    {
      displayName: "Model",
      name: "model",
      type: "string",
      default: "claude-sonnet-4-6",
      description: "Claude model used for brief extraction.",
    },
  ];
}

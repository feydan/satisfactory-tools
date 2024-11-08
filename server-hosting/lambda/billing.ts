import { DescribeInstancesCommand, EC2Client, StopInstancesCommand } from "@aws-sdk/client-ec2";
import { CostExplorerClient, GetCostAndUsageCommand, GetCostAndUsageCommandInput } from "@aws-sdk/client-cost-explorer";

const clientPricing = new CostExplorerClient();
const styleSheetLink = "https://unpkg.com/styled-css-base/presets/simple/index.css"

exports.handler = async function (event: any) {

  const month = new Date().getMonth() + 1
  const textMonth = month < 10 ? `0${month}` : month;
  const year = new Date().getFullYear()
  const d = new Date(year, month, 0).getDate()

  const commandCost = new GetCostAndUsageCommand({
    TimePeriod: {
      Start: `${year}-${textMonth}-01`,
      End: `${year}-${textMonth}-${d}`
    },
    Granularity: "MONTHLY",
    Metrics: ["UnblendedCost", "UsageQuantity"],
    Filter: {
      Dimensions: {
        Key: "SERVICE",
        Values: [
          "Amazon Elastic Compute Cloud - Compute",
          "EC2 - Other",
          "Amazon Virtual Private Cloud"
        ]
      }
    },
    "GroupBy": [
      {
        "Type": "DIMENSION",
        "Key": "SERVICE"
      }
    ]
  } as GetCostAndUsageCommandInput)

  const costEstimate = await clientPricing.send(commandCost)

  const totalBilling = costEstimate.ResultsByTime?.[0].Groups?.reduce((sum, current) => sum + parseFloat(current.Metrics?.UnblendedCost.Amount!), 0);

  return {
    statusCode: 200,
    headers: { "Content-Type": "text/html" },
    body: `<!DOCTYPE html><html><head><link rel="stylesheet" href="${styleSheetLink}" type="text/css"><title>Server</title></head><body><h1>Server Home page</h1><h1>Server successfully started</h1><p>Monthly invoice amount: ${totalBilling}$</p><p>Approximate monthly playing time: ${costEstimate.ResultsByTime?.[0].Groups?.[2].Metrics?.UsageQuantity.Amount} hours</p></body></html>`
  }
}
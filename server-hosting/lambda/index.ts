import { DescribeInstancesCommand, EC2Client, StartInstancesCommand } from "@aws-sdk/client-ec2";
import { CostExplorerClient, GetCostAndUsageCommand, GetCostAndUsageCommandInput } from "@aws-sdk/client-cost-explorer";

const instanceId = process.env.INSTANCE_ID
const client = new EC2Client({ region: process.env.AWS_REGION });
const command = new StartInstancesCommand({ InstanceIds: [instanceId!] });
const clientPricing = new CostExplorerClient();
const styleSheetLink = "https://unpkg.com/mvp.css"

exports.handler = async function (event: any) {

  console.log("Attempting to start game server", instanceId);
  try {
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
      "GroupBy":[
        {
          "Type":"DIMENSION",
          "Key":"SERVICE"
        }
      ]
    } as GetCostAndUsageCommandInput)

    const costEstimate = await clientPricing.send(commandCost)
    
    const totalBilling = costEstimate.ResultsByTime?.[0].Groups?.reduce((sum, current) => sum + parseFloat(current.Metrics?.UnblendedCost.Amount!), 0);

    // if (totalBilling! >= 20)
    //   return {
    //     statusCode: 200,
    //     headers: { "Content-Type": "text/json" },
    //     body: JSON.stringify({ message: "Cost have been above the defined spending budget this month. To be allowed to spend more, please contact an administrator." })
    //   }

    await client.send(command)
    await new Promise(resolve => setTimeout(resolve, 10000));

    const ipCommand = new DescribeInstancesCommand({
      InstanceIds: [instanceId!]
    })

    const resIP = await client.send(ipCommand)
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><link rel="stylesheet" href="${styleSheetLink}" type="text/css"><title>Server</title></head><body><h1>Server successfully started</h1><p>Server IP: ${resIP.Reservations?.[0].Instances?.[0].PublicIpAddress}</p><p>Monthly invoice amount: ${totalBilling}$</p><p>Approximate monthly playing time: ${costEstimate.ResultsByTime?.[0].Groups?.[2].Metrics?.UsageQuantity.Amount} hours</p></body></html>`
    }
  } catch (err) {
    return {
      statusCode: 200,
      headers: { "Content-Type": "text/html" },
      body: `<!DOCTYPE html><html><head><link rel="stylesheet" href="${styleSheetLink}" type="text/css"><title>Server</title></head><body><h1>Failed to start Satisfactory server</h1><pre>${JSON.stringify(err)}</pre></body></html>`
    }
  }
}
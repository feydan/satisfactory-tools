import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { Config } from './config';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3_assets from 'aws-cdk-lib/aws-s3-assets';
import * as lambda_nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as apigw from 'aws-cdk-lib/aws-apigateway';

export class ServerHostingStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // prefix for all resources in this stack
    const prefix = Config.prefix;

    //////////////////////////////////////////
    // Configure server, network and security
    //////////////////////////////////////////

    let lookUpOrDefaultVpc = (vpcId: string): ec2.IVpc => {
      // lookup vpc if given
      if (vpcId) {
        return ec2.Vpc.fromLookup(this, `${prefix}Vpc`, {
          vpcId
        })

        // use default vpc otherwise
      } else {
        return ec2.Vpc.fromLookup(this, `${prefix}Vpc`, {
          isDefault: true
        })
      }
    }

    let publicOrLookupSubnet = (subnetId: string, availabilityZone: string): ec2.SubnetSelection => {
      // if subnet id is given select it
      if (subnetId && availabilityZone) {
        return {
          subnets: [
            ec2.Subnet.fromSubnetAttributes(this, `${Config.prefix}ServerSubnet`, {
              availabilityZone,
              subnetId
            })
          ]
        };

        // else use any available public subnet
      } else {
        return { subnetType: ec2.SubnetType.PUBLIC };
      }
    }

    const vpc = lookUpOrDefaultVpc(Config.vpcId);
    const vpcSubnets = publicOrLookupSubnet(Config.subnetId, Config.availabilityZone);

    // configure security group to allow ingress access to game ports
    const securityGroup = new ec2.SecurityGroup(this, `${prefix}ServerSecurityGroup`, {
      vpc,
      description: "Allow Satisfactory client to connect to server",
    })

    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(7777), "Game port")
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(15000), "Beacon port")
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.udp(15777), "Query port")

    const server = new ec2.Instance(this, `${prefix}Server`, {
      // 2 vCPU, 8 GB RAM should be enough for most factories
      instanceType: new ec2.InstanceType("m6a.large"),
      // get exact ami from parameter exported by canonical
      // https://discourse.ubuntu.com/t/finding-ubuntu-images-with-the-aws-ssm-parameter-store/15507
      machineImage: ec2.MachineImage.fromSsmParameter("/aws/service/canonical/ubuntu/server/20.04/stable/current/amd64/hvm/ebs-gp2/ami-id"),
      // storage for steam, satisfactory and save files
      blockDevices: [
        {
          deviceName: "/dev/sda1",
          volume: ec2.BlockDeviceVolume.ebs(30, {volumeType: ec2.EbsDeviceVolumeType.GP3}),
        }
      ],
      // server needs a public ip to allow connections
      vpcSubnets,
      userDataCausesReplacement: true,
      vpc,
      securityGroup,
    })

    // Add Base SSM Permissions, so we can use AWS Session Manager to connect to our server, rather than external SSH.
    server.role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonSSMManagedInstanceCore'));

    //////////////////////////////
    // Configure save bucket
    //////////////////////////////

    let findOrCreateBucket = (bucketName: string): s3.IBucket => {
      // if bucket already exists lookup and use the bucket
      if (bucketName) {
        return s3.Bucket.fromBucketName(this, `${prefix}SavesBucket`, bucketName);
        // if bucket does not exist create a new bucket
        // autogenerate name to reduce possibility of conflict
      } else {
        return new s3.Bucket(this, `${prefix}SavesBucket`);
      }
    }

    // allow server to read and write save files to and from save bucket
    const savesBucket = findOrCreateBucket(Config.bucketName);
    savesBucket.grantReadWrite(server.role);

    //////////////////////////////
    // Configure instance startup
    //////////////////////////////

    // add aws cli
    // needed to download install script asset and
    // perform backups to s3
    server.userData.addCommands('sudo apt-get install unzip -y')
    server.userData.addCommands('curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" && unzip awscliv2.zip && ./aws/install')

    // package startup script and grant read access to server
    const startupScript = new s3_assets.Asset(this, `${Config.prefix}InstallAsset`, {
      path: './server-hosting/scripts/install.sh'
    });
    startupScript.grantRead(server.role);

    // download and execute startup script
    // with save bucket name as argument
    const localPath = server.userData.addS3DownloadCommand({
      bucket: startupScript.bucket,
      bucketKey: startupScript.s3ObjectKey,
    });
    server.userData.addExecuteFileCommand({
      filePath: localPath,
      arguments: `${savesBucket.bucketName} ${Config.useExperimentalBuild}`
    });

    //////////////////////////////
    // Add api to start server
    //////////////////////////////

    if (Config.restartApi && Config.restartApi === true) {
      const startServerLambda = new lambda_nodejs.NodejsFunction(this, `${Config.prefix}StartServerLambda`, {
        entry: './server-hosting/lambda/index.ts',
        description: "Restart game server",
        timeout: Duration.seconds(10),
        environment: {
          INSTANCE_ID: server.instanceId
        }
      })

      startServerLambda.addToRolePolicy(new iam.PolicyStatement({
        actions: [
          'ec2:StartInstances',
        ],
        resources: [
          `arn:aws:ec2:*:${Config.account}:instance/${server.instanceId}`,
        ]
      }))

      new apigw.LambdaRestApi(this, `${Config.prefix}StartServerApi`, {
        handler: startServerLambda,
        description: "Trigger lambda function to start server",
      })
    }
  }
}

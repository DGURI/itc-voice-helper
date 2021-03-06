"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

var _sqsConsumer = _interopRequireDefault(require("sqs-consumer"));

var _puppeteerCluster = require("puppeteer-cluster");

var _studentIdentityCheck = _interopRequireDefault(require("crawlers/studentIdentityCheck"));

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const {
  PUPPETEER_CLUSTER_HEADLESS,
  PUPPETEER_CLUSTER_MONITOR,
  SQS_QUEUE_URL,
  NODE_ENV,
  CHROME_BIN
} = process.env;

const consumer = async () => {
  let puppeteerOptions = {};
  console.log(NODE_ENV);
  console.log(CHROME_BIN);
  console.log(SQS_QUEUE_URL);

  if (NODE_ENV === 'production') {
    puppeteerOptions = {
      args: [// Required for Docker version of Puppeteer
      '--no-sandbox', '--disable-setuid-sandbox', // This will write shared memory files into /tmp instead of /dev/shm,
      // because Docker’s default for /dev/shm is 64MB
      '--disable-dev-shm-usage']
    };
  }

  const cluster = await _puppeteerCluster.Cluster.launch({
    concurrency: _puppeteerCluster.Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 2,
    monitor: PUPPETEER_CLUSTER_MONITOR === 'true',
    puppeteerOptions: {
      headless: PUPPETEER_CLUSTER_HEADLESS === 'true',
      ...puppeteerOptions
    }
  });
  cluster.on('taskerror', (err, data) => {
    let reData = data;

    if (typeof data === 'object') {
      reData = JSON.stringify(data);
    }

    console.log(`Error crawling ${reData}: ${err.message}`);
  });

  const app = _sqsConsumer.default.create({
    queueUrl: SQS_QUEUE_URL,
    attributeNames: ['All'],
    messageAttributeNames: ['Type', 'UserId', 'UserStudentId', 'UserStudentPw'],
    handleMessage: (message, done) => {
      // do some work with `message`
      const {
        MessageAttributes
      } = message;
      const type = MessageAttributes.Type.StringValue;
      const userId = MessageAttributes.UserId.StringValue;
      const userStudentId = MessageAttributes.UserStudentId.StringValue;
      const userStudentPw = MessageAttributes.UserStudentPw.StringValue;
      cluster.queue({
        userId,
        userStudentId,
        userStudentPw
      }, _studentIdentityCheck.default);
      done();
    }
  });

  app.on('error', err => {
    console.log(err.message);
  });
  app.start();
  await cluster.idle();
  return {
    consumerServer: app,
    consumerCluster: cluster
  };
};

var _default = consumer;
exports.default = _default;
# BullMQ

!image.png

এখন পুরো জিনিসটা মজার গল্পে বুঝি। ধরো **"ভাইয়া বিরিয়ানি হাউস"** — ঢাকার একটা বিখ্যাত রেস্টুরেন্ট। এই রেস্টুরেন্টের সিস্টেমটাই হলো BullMQ!

---

### Queue = কাউন্টারের ভাই (অর্ডার নেওয়ার মানুষ)

কল্পনা করো, কাউন্টারে একজন ভাই বসে আছে। তুমি গেলে সে বলে — *"ভাই কী নেবেন?"* তুমি বললে **"এক প্লেট বিরিয়ানি, এক গ্লাস লাচ্ছি"** — সে একটা স্লিপ লিখে **অর্ডার খাতায় (Redis)** রাখে। সে নিজে রান্না করে না, শুধু অর্ডার নেয় আর লিস্টে রাখে।

```bash
import { Queue } from 'bullmq';

// কাউন্টারের ভাই রেডি
const biryaniQueue = new Queue('biryani-house', {
  connection: { host: 'localhost', port: 6379 },
  defaultJobOptions: {
    attempts: 3, // রান্না ৩ বার ট্রাই করবে, না হলে বাদ
    backoff: { type: 'exponential', delay: 2000 }
  }
});

// কাস্টমার অর্ডার দিলো
await biryaniQueue.add('biryani-order', {
  customer: 'রাকিব ভাই',
  item: 'মোরগ পোলাও',
  quantity: 2,
  tableNo: 7
});

// বিশেষ অর্ডার — ৩০ মিনিট পর রান্না শুরু করো (delay)
await biryaniQueue.add('special-order', {
  customer: 'সাহেব সাহেব',
  item: 'কাচ্চি বিরিয়ানি'
}, { delay: 30 * 60 * 1000 }); // ৩০ মিনিট পর

// প্রতিদিন রাত ১২টায় অটো ক্লিনআপ (repeat/cron)
await biryaniQueue.add('daily-cleanup', {}, {
  repeat: { pattern: '0 0 * * *' }
});
```

**মজার বিষয়:** Queue কখনো থামে না — রাত ৩টায়ও অর্ডার নিতে পারে। সে শুধু খাতায় লেখে, রান্না তার কাজ না।

---

### Worker = রাঁধুনি ভাই (আসল কাজের মানুষ)

রান্নাঘরে রাঁধুনি ভাই বসে আছে। সে খাতা (Redis) থেকে অর্ডার তুলে রান্না করে। একসাথে ৫টা অর্ডার সামলাতে পারে — এটাই `concurrency`!

```bash
import { Worker } from 'bullmq';

const radhuniBhai = new Worker('biryani-house', async (job) => {
  console.log(`${job.data.customer}-এর অর্ডার পেলাম!`);
  // job.name  = 'biryani-order'
  // job.data  = { customer: 'রাকিব ভাই', item: 'মোরগ পোলাও', ... }

  // রান্নার ধাপ
  await job.updateProgress(10); // চাল ধোয়া শুরু
  await chaaldhua(job.data.item);

  await job.updateProgress(50); // রান্না চলছে
  await rannhaKoro(job.data.item, job.data.quantity);

  await job.updateProgress(90); // প্লেটে সাজানো
  await plateSajao(job.data.tableNo);

  await job.updateProgress(100);
  return { status: 'পরিবেশন সম্পন্ন', time: new Date() };

}, {
  connection: { host: 'localhost', port: 6379 },
  concurrency: 5, // একসাথে ৫টা রান্না চলবে

  // রেট লিমিট: প্রতি মিনিটে সর্বোচ্চ ৩০টা অর্ডার
  limiter: { max: 30, duration: 60_000 }
});

// রাঁধুনি ভাইয়ের রিঅ্যাকশন
radhuniBhai.on('completed', (job, result) => {
  console.log(`Table ${job.data.tableNo} - রান্না শেষ!`, result);
});

radhuniBhai.on('failed', (job, err) => {
  // গ্যাস শেষ হয়ে গেছে?
  console.error(`অর্ডার ব্যর্থ: ${err.message}`);
});

radhuniBhai.on('progress', (job, progress) => {
  console.log(`${job.data.customer}র অর্ডার ${progress}% সম্পন্ন`);
});
```

**মজার বিষয়:** রাঁধুনি ভাই যদি হঠাৎ অজ্ঞান হয়ে যায় (server crash), Redis খাতা থেকে আবার অর্ডার তুলে সে নিজেই retry করবে। কোনো অর্ডার হারাবে না!

---

### QueueEvents = ম্যানেজার ভাই (সব খবর রাখে)

ম্যানেজার ভাই রেস্টুরেন্টের বাইরে বসে CCTV দেখছেন। রান্না হলে তিনি জানেন, পুড়ে গেলেও তিনি জানেন — কিন্তু তিনি নিজে কিছু করেন না, শুধু দেখেন ও রিপোর্ট করেন।

```bash
import { QueueEvents } from 'bullmq';

const managerBhai = new QueueEvents('biryani-house', {
  connection: { host: 'localhost', port: 6379 }
});

// যেকোনো worker-এর যেকোনো job complete হলে জানবেন
managerBhai.on('completed', ({ jobId, returnvalue }) => {
  console.log(`[MANAGER] Job ${jobId} সম্পন্ন:`, returnvalue);
  // Bkash-এ নোটিফিকেশন পাঠাও মালিককে
});

// কেউ ব্যর্থ হলেও জানবেন
managerBhai.on('failed', ({ jobId, failedReason }) => {
  console.error(`[MANAGER] সমস্যা! Job ${jobId}: ${failedReason}`);
  // মালিককে ফোন করো!
});

// রান্নার প্রগ্রেস দেখছেন
managerBhai.on('progress', ({ jobId, data }) => {
  console.log(`[MANAGER] Job ${jobId} এখন ${data}% সম্পন্ন`);
});

// Queue খালি হলে (সব অর্ডার শেষ)
managerBhai.on('drained', () => {
  console.log('[MANAGER] আজকের সব অর্ডার শেষ! রেস্টুরেন্ট বন্ধ করো।');
});

// ---- সবচেয়ে মজার ফিচার ----
// তুমি একটা অর্ডার দিয়ে সেটা শেষ হওয়া পর্যন্ত wait করতে পারো!
const myOrder = await biryaniQueue.add('my-order', { item: 'কাচ্চি' });
const result = await myOrder.waitUntilFinished(managerBhai, 60_000);
// রান্না শেষ না হওয়া পর্যন্ত এখানেই বসে থাকবে (১ মিনিট timeout)
console.log('রান্না হয়েছে!', result);
```

**মজার বিষয়:** Worker শুধু নিজের রান্নার খবর জানে। Manager ভাই সব worker-এর সব কিছু জানেন — ড্যাশবোর্ড বানাতে, লগ রাখতে এই class দরকার।

---

### FlowProducer = হেড শেফ ভাই (জটিল রান্নার পরিকল্পনাকারী)

কাচ্চি বিরিয়ানি বানাতে গেলে ধাপে ধাপে কাজ করতে হয় — আগে মাংস মেরিনেট, তারপর ভাত আধা-সেদ্ধ, তারপর একসাথে দম দেওয়া। একটা শেষ না হলে পরেরটা শুরু করা যাবে না। এটাই `FlowProducer`!

```bash
import { FlowProducer } from 'bullmq';

const headChef = new FlowProducer({
  connection: { host: 'localhost', port: 6379 }
});

// কাচ্চি বানানোর পুরো workflow
await headChef.add({
  name: 'serve-kacchi', // শেষে এটা চলবে — সব শেষে পরিবেশন
  queueName: 'serving-queue',
  data: { tableNo: 5 },

  children: [
    {
      name: 'dum-dewa', // দম দেওয়া — এটা চলবে children শেষে
      queueName: 'cooking-queue',
      data: { temp: '180c', duration: '45min' },

      children: [
        {
          name: 'marinate-meat', // সবার আগে এটা
          queueName: 'prep-queue',
          data: { meat: 'mutton', spices: ['আদা', 'রসুন', 'দই'] }
        },
        {
          name: 'half-boil-rice', // এটাও আগে (parallel চলবে!)
          queueName: 'prep-queue',
          data: { rice: 'বাসমতি', water: '2L' }
        }
      ]
    }
  ]
});

// Serving worker-এ child-দের result পাওয়া যাবে
const servingWorker = new Worker('serving-queue', async (job) => {
  const childResults = await job.getChildrenValues();
  // childResults-এ marinate + boil দুটোর result আছে
  console.log('সব তৈরি, এখন পরিবেশন:', childResults);
  return { served: true, table: job.data.tableNo };
});
```

**মজার বিষয়:** `marinate-meat` আর `half-boil-rice` দুটো একসাথে চলবে (parallel)। কিন্তু `dum-dewa` শুরু হবে শুধু তখন যখন দুটোই শেষ। আর `serve-kacchi` চলবে সব শেষে। কোনো ধাপ miss হবে না!

---

সব একসাথে — পূর্ণ সিস্টেম

```bash
import { Queue, Worker, QueueEvents, FlowProducer } from 'bullmq';

const conn = { connection: { host: 'localhost', port: 6379 } };

// ১. কাউন্টার সেটআপ
const queue = new Queue('biryani-house', conn);

// ২. রাঁধুনি ভাই সেটআপ (৩ জন রাঁধুনি, concurrency:3)
const worker = new Worker('biryani-house', async (job) => {
  await rannhaKoro(job.data);
  return { done: true };
}, { ...conn, concurrency: 3 });

// ৩. ম্যানেজার ভাই সেটআপ
const events = new QueueEvents('biryani-house', conn);
events.on('completed', ({ jobId }) =>
  console.log(`অর্ডার ${jobId} সম্পন্ন!`)
);

// ৪. হেড শেফ (জটিল অর্ডারের জন্য)
const flow = new FlowProducer(conn);

// কাস্টমার অর্ডার
const job = await queue.add('simple-order', { item: 'পোলাও' });

// অর্ডার শেষ হওয়া পর্যন্ত অপেক্ষা করো
const result = await job.waitUntilFinished(events, 120_000);
console.log('রান্না হয়েছে ভাই!', result);
```

### সংক্ষেপে মনে রাখো

| Class | রেস্টুরেন্ট উপমা | কাজ |
| --- | --- | --- |
| `Queue` | কাউন্টারের ভাই | অর্ডার নেয়, Redis-এ রাখে |
| `Worker` | রাঁধুনি ভাই | Redis থেকে অর্ডার তুলে কাজ করে |
| `QueueEvents` | ম্যানেজার ভাই | সব কিছু দেখে, রিপোর্ট করে |
| `FlowProducer` | হেড শেফ ভাই | জটিল workflow/dependency তৈরি করে |
| `Redis` | অর্ডার খাতা | সব কিছু মনে রাখে, কিছু হারায় না |
| `Job` | একটা অর্ডার স্লিপ | এক একটা কাজের unit |

BullMQ consist with 4 classes:
 

1. Queue
2. Worker
3. QueueEvent
4. FlowProducer

Queue        → simple account job add করতে পারে
Worker       → per account transaction sync করবে
QueueEvents  → progress/failed/completed track করবে
FlowProducer → all child job শেষে parent finalize job চালাবে

#### Queue

```bash
import { Queue } from 'bullmq';

const transactionQueue = new Queue('transaction-sync', {
  connection: redisConnection,
});

await transactionQueue.add(
  'sync-transactions',
  {
    accountId: 'acc_123',
  },
  {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: true,
    removeOnFail: 50,
  },
);
```

#### Worker

```bash
import { Worker, Job } from 'bullmq';

const worker = new Worker(
  'transaction-sync',
  async (job: Job) => {
    console.log('Processing job:', job.id);
    console.log('Job data:', job.data);

    // actual business logic
    await syncTransactionsForAccount(job.data.accountId);

    return {
      success: true,
    };
  },
  {
    connection: redisConnection,
    concurrency: 3,
    lockDuration: 2 * 60 * 1000,
  },
);
```

#### QueueEvent

```bash
import { QueueEvents } from 'bullmq';

const queueEvents = new QueueEvents('transaction-sync', {
  connection: redisConnection,
});

queueEvents.on('completed', ({ jobId, returnvalue }) => {
  console.log('Job completed globally:', jobId, returnvalue);
});

queueEvents.on('failed', ({ jobId, failedReason }) => {
  console.log('Job failed globally:', jobId, failedReason);
});

queueEvents.on('progress', ({ jobId, data }) => {
  console.log('Job progress:', jobId, data);
});
```

#### FlowProducer

```bash
import { FlowProducer } from 'bullmq';

const flowProducer = new FlowProducer({
  connection: redisConnection,
});

await flowProducer.add({
  name: 'finalize-transaction-sync',
  queueName: 'transaction-sync-parent',
  data: {
    syncRunId: 'run_123',
  },
  children: [
    {
      name: 'sync-account-transactions',
      queueName: 'transaction-sync-child',
      data: {
        accountId: 'acc_1',
      },
    },
    {
      name: 'sync-account-transactions',
      queueName: 'transaction-sync-child',
      data: {
        accountId: 'acc_2',
      },
    },
  ],
});
```

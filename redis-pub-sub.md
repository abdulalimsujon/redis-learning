# Redis Pub/Sub

## Flow

```text
Client
   │
   ▼
Publisher (Express API)
   │
publish(channel, message)
   │
   ▼
Redis Channel (notifications)
   │
   ├────────► Subscriber A
   ├────────► Subscriber B
   └────────► Subscriber C
```

---

# Publisher

```javascript
app.post("/notifications", async (req, res) => {
  const payload = {
    title: req.body.title || "Default Title",
    createdAt: new Date().toISOString(),
  };

  const receivers = await publisher.publish(
    "notifications",
    JSON.stringify(payload)
  );

  res.json({
    success: true,
    receivers,
  });
});
```

### Notes

- Create a payload.
- Convert object → string using `JSON.stringify()`.
- Publish to the `notifications` channel.
- `publish()` returns the number of active subscribers.

---

# Subscriber

```javascript
subscriber.subscribe("notifications", (err) => {
  if (err) {
    console.error(err.message);
    return;
  }

  console.log("Subscribed Successfully!");
});
```

### Notes

- Subscribe to the `notifications` channel.
- After subscribing, Redis starts sending messages from that channel.

---

# Receive Message

```javascript
subscriber.on("message", (channel, message) => {
  const data = JSON.parse(message);

  console.log(channel);
  console.log(data);
});
```

### Notes

- `channel` → Channel name.
- `message` → Published message (String).
- `JSON.parse()` converts String → Object.

---

# Example

### Client Request

```http
POST /notifications
```

Body

```json
{
  "title": "Payment Successful"
}
```

---

### Publisher sends

```javascript
{
  title: "Payment Successful",
  createdAt: "2026-08-04T10:30:00.000Z"
}
```

↓

```javascript
publisher.publish(
  "notifications",
  JSON.stringify(payload)
);
```

---

### Subscriber receives

```javascript
subscriber.on("message", (channel, message) => {
  const data = JSON.parse(message);

  console.log(data.title);
});
```

Output

```text
Payment Successful
```

---

# Important Methods

| Method | Purpose |
|---------|---------|
| `publish(channel, message)` | Publish a message |
| `subscribe(channel)` | Listen to a channel |
| `on("message")` | Receive published messages |
| `JSON.stringify()` | Object → String |
| `JSON.parse()` | String → Object |

---

# Important Points

- Pub/Sub is **real-time**.
- Redis **does not store** Pub/Sub messages.
- Offline subscribers **miss messages**.
- One publisher can send messages to multiple subscribers.
- `publish()` returns the number of active subscribers.

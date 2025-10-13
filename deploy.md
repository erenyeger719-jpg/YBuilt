# YBUILT Deployment Guide

## Environment Configuration

### Development (Mock Mode)
Default configuration - no setup required:
```bash
npm install
npm run dev
```

### Staging (Test Mode)
1. Create `.env` file:
```bash
RAZORPAY_MODE=test
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
```

2. Start server:
```bash
npm run dev
```

### Production (Live Mode)
1. Set environment variables:
```bash
RAZORPAY_MODE=live
RAZORPAY_KEY_ID=rzp_live_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxxxxxxxxxxxxxxxxx
```

2. Configure webhook URL in Razorpay Dashboard:
   - URL: `https://yourdomain.com/webhooks/razorpay`
   - Events: `payment.captured`

3. Deploy:
```bash
npm run build
npm start
```

## Switching Between Modes

### Mock → Test
1. Add test credentials to `.env`
2. Set `RAZORPAY_MODE=test`
3. Restart server

### Test → Live
1. Update credentials to live keys
2. Set `RAZORPAY_MODE=live`
3. Configure production webhook
4. Deploy to production

### Live → Mock (for testing)
1. Remove/comment out RAZORPAY_MODE
2. Restart server
3. System automatically uses mock mode

## Payment Testing

### Mock Mode Testing
Use the simulate endpoint to test payment flows without real transactions:

```bash
curl -X POST http://localhost:5000/api/payments/simulate \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "demo",
    "amount": 799,
    "orderId": "test_order_123"
  }'
```

Expected response:
```json
{
  "success": true,
  "credits": 1,
  "paymentId": "pay_mock_1234567890",
  "message": "Payment simulated successfully"
}
```

### Test Mode Testing
1. Use Razorpay test cards:
   - Success: `4111 1111 1111 1111`
   - CVV: Any 3 digits
   - Expiry: Any future date

2. Complete payment flow in test environment
3. Verify webhook delivery in Razorpay dashboard
4. Check credits updated in user account

### Production Checklist
- [ ] Live Razorpay credentials configured
- [ ] Webhook URL configured in Razorpay dashboard
- [ ] Webhook signature verification enabled
- [ ] SSL certificate installed
- [ ] Payment logs monitoring configured
- [ ] Error tracking enabled
- [ ] Backup payment gateway configured (optional)

## Monitoring

### Payment Logs
All payments are logged to `data/payments.log`:

```json
{
  "timestamp": "2025-01-01T00:00:00.000Z",
  "mode": "simulated|live|test",
  "userId": "user-id",
  "amount": 799,
  "credits": 1,
  "orderId": "order_xxx",
  "paymentId": "pay_xxx"
}
```

### Health Checks
- Check Razorpay mode: `curl http://localhost:5000/api/razorpay_key`
- Verify user credits: `curl http://localhost:5000/api/credits/demo`
- Monitor webhook delivery in Razorpay dashboard

## Troubleshooting

### Razorpay Not Initializing
**Symptom:** Payment button disabled, console shows Razorpay errors

**Solution:**
1. Check RAZORPAY_MODE is set correctly
2. Verify API keys are valid
3. Ensure Razorpay npm package is installed: `npm install razorpay`

### Webhook Signature Verification Failed
**Symptom:** Webhook returns 400 "Invalid signature"

**Solution:**
1. Verify RAZORPAY_WEBHOOK_SECRET matches Razorpay dashboard
2. Check webhook URL is using raw body parser
3. Ensure signature header is passed: `x-razorpay-signature`

### Credits Not Added
**Symptom:** Payment successful but credits not updated

**Solution:**
1. Check `data/payments.log` for payment record
2. Verify user ID matches in payment notes
3. Check storage.addCredits() is called correctly
4. Review webhook event type (should be `payment.captured`)

## Security Best Practices

1. **Never commit `.env` files** - Add to `.gitignore`
2. **Rotate webhook secrets regularly** - Update every 90 days
3. **Use HTTPS in production** - Required for Razorpay webhooks
4. **Validate webhook signatures** - Always verify HMAC SHA256
5. **Rate limit payment endpoints** - Prevent abuse
6. **Monitor payment anomalies** - Set up alerts for unusual activity
7. **Log all payment events** - Maintain audit trail

## Support

For Razorpay integration issues:
- Razorpay Docs: https://razorpay.com/docs/
- Razorpay Support: support@razorpay.com
- YBUILT Issues: [Create GitHub Issue]

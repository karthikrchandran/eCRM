# Omnichannel Integration Setup Guide: emailVoice + Knowledge Base

**Date**: 2026-08-18  
**Status**: Partially implemented (adapters exist, needs credential configuration)  
**Total Setup Cost**: ~$0–150/month (depending on volume)

---

## Executive Summary

emailVoice already has **WhatsApp, Facebook, Telegram** adapters built in. You need to:
1. ✅ **Configure** provider credentials (API keys)
2. ✅ **Connect** knowledge base (already using pgvector)
3. ✅ **Wire** messaging channels to chatbot
4. ⚠️ **Add** missing channels (LinkedIn, Google Business, RCS)
5. ✅ **Monitor** via webhooks and dead-letter queues

---

## Part 1: Current Implementation Status

### What's Already Built In ✅

| Channel | Status | Notes |
|---------|--------|-------|
| **WhatsApp Cloud API** | ✅ Full Adapter | Production-ready |
| **Facebook Messenger** | ✅ Full Adapter | Production-ready |
| **Telegram** | ✅ Full Adapter | Production-ready |
| **SendGrid Email** | ✅ Full Integration | Production-ready |
| **SMTP Email** | ✅ Full Integration | Generic fallback |
| **Twilio Voice/SMS** | ✅ Full Integration | Call recording + transcription |
| **Knowledge Base (pgvector)** | ✅ Full Setup | Semantic search ready |
| **Webhook Infrastructure** | ✅ Generic Queue | Dedup, dead-letter, audit logs |

### What's Missing ⚠️

| Channel | Status | Est. Dev Time |
|---------|--------|----------------|
| **LinkedIn Messaging** | 🔴 Placeholder only | 4–6 hours |
| **Google Business Messages** | 🔴 Not started | 6–8 hours |
| **Apple Messages for Business** | 🔴 Not started | 8–10 hours |
| **RCS (Rich Communication Services)** | 🔴 Not started | 6–8 hours |
| **Intercom/Zendesk Chat Sync** | 🔴 Not started | 4–6 hours |
| **Slack Integration** | 🔴 Not started | 3–4 hours |

---

## Part 2: Configuration Setup (What You Need to Do Now)

### Step 2.1: WhatsApp Cloud API Setup

**Prerequisites:**
- Meta Business Account + WhatsApp Business Account
- Phone number registered
- API credentials from Meta

**In emailVoice Application:**

1. **Navigate to**: Provider Settings → WhatsApp
2. **Add credentials**:
   ```
   WHATSAPP_BUSINESS_ACCOUNT_ID=<your-business-account-id>
   WHATSAPP_PHONE_NUMBER_ID=<your-phone-number-id>
   WHATSAPP_ACCESS_TOKEN=<your-access-token>
   WHATSAPP_WEBHOOK_VERIFY_TOKEN=<generate-random-string>
   ```

3. **In Meta Cloud Console**, set webhook:
   ```
   https://your-emailvoice-domain/api/v1/chatbot/webhooks/whatsapp
   Verify Token: <same as WHATSAPP_WEBHOOK_VERIFY_TOKEN>
   Subscribe to: messages, message_status, message_template_status_update
   ```

4. **Create channel in emailVoice**:
   ```bash
   POST /api/v1/chatbot/channels
   {
     "type": "whatsapp",
     "name": "WhatsApp - Support",
     "config": {
       "business_account_id": "...",
       "phone_number_id": "...",
       "webhook_url": "https://your-domain/api/v1/chatbot/webhooks/whatsapp"
     }
   }
   ```

**Cost**: $0 (free tier for small volumes, 1000 msgs/day)

---

### Step 2.2: Facebook Messenger Setup

**Prerequisites:**
- Facebook Business Account
- Facebook App + Messenger Product
- Page linked to app

**In emailVoice Application:**

1. **Navigate to**: Provider Settings → Facebook
2. **Add credentials**:
   ```
   FACEBOOK_PAGE_ACCESS_TOKEN=<your-page-access-token>
   FACEBOOK_APP_ID=<your-app-id>
   FACEBOOK_APP_SECRET=<your-app-secret>
   FACEBOOK_WEBHOOK_VERIFY_TOKEN=<generate-random-string>
   ```

3. **In Facebook App Settings**, set webhook:
   ```
   Callback URL: https://your-emailvoice-domain/api/v1/chatbot/webhooks/facebook
   Verify Token: <same as FACEBOOK_WEBHOOK_VERIFY_TOKEN>
   Subscribe to: messages, messaging_postbacks, message_reads, message_deliveries
   ```

4. **Create channel in emailVoice**:
   ```bash
   POST /api/v1/chatbot/channels
   {
     "type": "facebook",
     "name": "Facebook Messenger - Support",
     "config": {
       "page_access_token": "...",
       "page_id": "..."
     }
   }
   ```

**Cost**: $0 (free tier for small volumes)

---

### Step 2.3: Telegram Setup

**Prerequisites:**
- Telegram Bot created via BotFather
- Bot token

**In emailVoice Application:**

1. **Navigate to**: Provider Settings → Telegram
2. **Add credentials**:
   ```
   TELEGRAM_BOT_TOKEN=<your-bot-token>
   ```

3. **Set webhook**:
   ```bash
   curl -X POST https://api.telegram.org/bot<TOKEN>/setWebhook \
     -d url=https://your-emailvoice-domain/api/v1/chatbot/webhooks/telegram
   ```

4. **Create channel in emailVoice**:
   ```bash
   POST /api/v1/chatbot/channels
   {
     "type": "telegram",
     "name": "Telegram Support Bot",
     "config": {
       "bot_token": "..."
     }
   }
   ```

**Cost**: $0 (completely free)

---

### Step 2.4: SendGrid Email Setup

**Prerequisites:**
- SendGrid account + API key
- Verified sender domain

**In emailVoice Application:**

1. **Navigate to**: Provider Settings → Email → SendGrid
2. **Add credentials**:
   ```
   SENDGRID_API_KEY=<your-sendgrid-api-key>
   SENDGRID_FROM_EMAIL=support@yourdomain.com
   ```

3. **Set webhook for delivery/bounce tracking**:
   ```
   Settings → Mail Send → Event Webhook
   URL: https://your-emailvoice-domain/api/v1/email/webhooks/sendgrid
   Subscribe to: delivered, bounce, open, click, dropped
   ```

4. **Test send**:
   ```bash
   POST /api/v1/email/send
   {
     "to": "test@example.com",
     "subject": "Test from emailVoice",
     "template": "welcome",
     "provider": "sendgrid"
   }
   ```

**Cost**: ~$20/month (100k emails/month on free tier, then ~$10 per 10k additional)

---

### Step 2.5: Twilio Voice/SMS Setup

**Prerequisites:**
- Twilio account + API credentials
- Phone number provisioned

**In emailVoice Application:**

1. **Navigate to**: Provider Settings → Voice → Twilio
2. **Add credentials**:
   ```
   TWILIO_ACCOUNT_SID=<your-account-sid>
   TWILIO_AUTH_TOKEN=<your-auth-token>
   TWILIO_PHONE_NUMBER=+1234567890
   TWILIO_WEBHOOK_URL=https://your-emailvoice-domain/api/v1/voice/webhooks/twilio
   ```

3. **Configure in Twilio Console**:
   ```
   Phone Number Settings → Voice
   Webhook URL: https://your-emailvoice-domain/api/v1/voice/webhooks/twilio
   Webhook Methods: POST
   ```

4. **Create channel in emailVoice**:
   ```bash
   POST /api/v1/chatbot/channels
   {
     "type": "voice",
     "name": "Phone Support Line",
     "config": {
       "provider": "twilio",
       "phone_number": "+1234567890",
       "webhook_url": "..."
     }
   }
   ```

**Cost**: ~$1–2/month per phone number + $0.0075 per inbound minute

---

## Part 3: Knowledge Base Configuration

### Step 3.1: Upload Documents to Knowledge Base

**File Structure** (what's expected):
```
PDF, DOCX, TXT, MD files with metadata:
- title
- source_url
- category
- tags
```

**In emailVoice Application:**

1. **Navigate to**: Knowledge Base → Upload Documents
2. **Create knowledge source**:
   ```bash
   POST /api/v1/chatbot/knowledge-sources
   {
     "workspace_id": "your-workspace-id",
     "name": "Company Documentation",
     "description": "FAQ, Product Docs, Support Articles",
     "type": "document",
     "config": {
       "chunk_size": 512,
       "chunk_overlap": 128,
       "embedding_model": "nomic-embed-text"
     }
   }
   ```

3. **Upload documents**:
   ```bash
   POST /api/v1/chatbot/knowledge-sources/{source_id}/documents
   Content-Type: multipart/form-data
   file: <your-pdf-or-docx>
   metadata: {"title": "...", "category": "..."}
   ```

4. **Monitor indexing status**:
   ```bash
   GET /api/v1/chatbot/knowledge-sources/{source_id}/documents
   # Status: PENDING → INDEXING → READY
   ```

### Step 3.2: Connect Knowledge Base to Chatbot

**In emailVoice Application:**

1. **Edit chatbot settings**:
   ```bash
   PATCH /api/v1/chatbot/channels/{channel_id}
   {
     "knowledge_sources": [
       {
         "source_id": "your-knowledge-source-id",
         "weight": 1.0,
         "min_relevance_score": 0.7
       }
     ],
     "system_prompt": "You are a helpful support assistant. Use the knowledge base to answer questions.",
     "model": "gpt-4o-mini",
     "temperature": 0.7
   }
   ```

2. **Test semantic search**:
   ```bash
   POST /api/v1/chatbot/knowledge-sources/search
   {
     "query": "How do I reset my password?",
     "top_k": 5,
     "threshold": 0.7
   }
   ```

### Step 3.3: Embeddings Configuration

**Current Setup** (pgvector + Ollama):
```dockerfile
# In compose.yml
ollama:
  image: ollama/ollama:latest
  environment:
    MODEL: nomic-embed-text  # 768-dim embeddings
  ports:
    - "11434:11434"
```

**To change embedding model**:
```
.env:
EMBEDDING_MODEL=nomic-embed-text  # or:
EMBEDDING_PROVIDER=openai          # for OpenAI embeddings
OPENAI_API_KEY=...
```

**Cost**:
- **Ollama (local)**: $0 (runs in container)
- **OpenAI embeddings**: ~$0.10 per 1M tokens (~1.3M vectors)

---

## Part 4: Website Chatbot Setup

### Step 4.1: Add Website Widget

**Create public channel**:
```bash
POST /api/v1/chatbot/channels
{
  "type": "web",
  "name": "Website Support Widget",
  "is_public": true,
  "config": {
    "theme": "light",
    "position": "bottom-right",
    "header_text": "How can we help?",
    "placeholder": "Type your question...",
    "show_powered_by": true
  }
}
```

**Get embed code**:
```bash
GET /api/v1/chatbot/channels/{channel_id}/embed-code
# Returns:
# <script src="https://your-emailvoice-domain/chatbot-widget.js" 
#         data-channel-id="..."></script>
```

**Add to website HTML**:
```html
<!-- At end of body tag -->
<script src="https://your-emailvoice-domain/chatbot-widget.js" 
        data-channel-id="your-channel-id"></script>
```

### Step 4.2: Connect to Knowledge Base

Same as Step 3.2 above — the web channel will auto-search KB for responses.

---

## Part 5: Application Code Changes Needed

### Step 5.1: Create Chatbot Controller

**File**: `apps/api/app/api/v1/chatbot/routes.py`

```python
from fastapi import APIRouter, HTTPException, Depends
from app.domain.chatbot.chatbot_service import ChatbotService
from app.infrastructure.auth import get_current_workspace

router = APIRouter(prefix="/api/v1/chatbot", tags=["chatbot"])

@router.post("/channels")
async def create_channel(
    payload: CreateChannelRequest,
    workspace_id: str = Depends(get_current_workspace)
):
    """Create a new messaging channel (WhatsApp, Facebook, etc.)"""
    service = ChatbotService()
    channel = await service.create_channel(
        workspace_id=workspace_id,
        channel_type=payload.type,
        config=payload.config
    )
    return channel

@router.post("/knowledge-sources/{source_id}/documents")
async def upload_documents(
    source_id: str,
    file: UploadFile,
    workspace_id: str = Depends(get_current_workspace)
):
    """Upload document to knowledge base"""
    service = ChatbotService()
    doc = await service.index_document(
        source_id=source_id,
        file=file,
        workspace_id=workspace_id
    )
    return doc

@router.post("/webhooks/{channel_type}")
async def handle_webhook(
    channel_type: str,
    body: dict,
    request: Request
):
    """Universal webhook handler for all channels"""
    # Verify signature based on channel_type
    # Deduplicate message ID
    # Queue for processing
    # Return 200 immediately
    pass
```

### Step 5.2: Add Provider Credential Encryption

**File**: `apps/api/app/domain/provider_credentials/provider_credential_repository.py`

```python
from app.infrastructure.encryption import EncryptionService

class ProviderCredentialRepository:
    def __init__(self, encryption_service: EncryptionService):
        self.encryption = encryption_service
    
    async def store_credential(
        self,
        workspace_id: str,
        provider: str,  # "whatsapp", "facebook", "sendgrid", etc.
        credentials: dict
    ):
        """Store encrypted provider credentials"""
        encrypted = self.encryption.encrypt_json(credentials)
        await db.execute("""
            INSERT INTO provider_credentials 
            (workspace_id, provider, encrypted_data, created_at)
            VALUES ($1, $2, $3, NOW())
        """, workspace_id, provider, encrypted)
    
    async def get_credential(
        self,
        workspace_id: str,
        provider: str
    ) -> dict:
        """Retrieve and decrypt credentials"""
        row = await db.fetch_one("""
            SELECT encrypted_data FROM provider_credentials
            WHERE workspace_id = $1 AND provider = $2
        """, workspace_id, provider)
        return self.encryption.decrypt_json(row['encrypted_data'])
```

### Step 5.3: Knowledge Base Integration Service

**File**: `apps/api/app/domain/chatbot/knowledge_base_service.py`

```python
from app.infrastructure.rag.embedder import Embedder
from app.infrastructure.vector_store.chunk_repository import ChunkRepository

class KnowledgeBaseService:
    def __init__(self):
        self.embedder = Embedder()  # Uses pgvector + Ollama
        self.chunk_repo = ChunkRepository()
    
    async def search_knowledge_base(
        self,
        query: str,
        workspace_id: str,
        source_ids: list[str],
        top_k: int = 5,
        threshold: float = 0.7
    ) -> list[dict]:
        """Semantic search over knowledge base"""
        # Generate embedding for query
        query_embedding = await self.embedder.embed(query)
        
        # Search pgvector using cosine distance
        results = await self.chunk_repo.search(
            workspace_id=workspace_id,
            source_ids=source_ids,
            embedding=query_embedding,
            limit=top_k,
            threshold=threshold
        )
        
        return [
            {
                "content": r.content,
                "source": r.source_url,
                "score": r.similarity_score,
                "metadata": r.metadata
            }
            for r in results
        ]
    
    async def augment_chatbot_prompt(
        self,
        user_message: str,
        workspace_id: str,
        channel_id: str
    ) -> str:
        """Inject knowledge base context into chatbot prompt"""
        # Get knowledge sources linked to this channel
        sources = await self.get_channel_knowledge_sources(channel_id)
        
        # Search KB for relevant docs
        kb_results = await self.search_knowledge_base(
            query=user_message,
            workspace_id=workspace_id,
            source_ids=[s.id for s in sources]
        )
        
        # Format as RAG context
        context = "\n".join([
            f"- {r['content']}\n  (Source: {r['source']})"
            for r in kb_results
        ])
        
        return f"""You are a helpful support assistant. 
Use the following knowledge base to answer questions:

{context}

User question: {user_message}"""
```

### Step 5.4: Webhook Handler for Messages

**File**: `apps/api/app/api/v1/chatbot/webhooks.py`

```python
from fastapi import APIRouter, Request, BackgroundTasks
from app.domain.chatbot.message_processor import MessageProcessor
import hmac
import hashlib

router = APIRouter(prefix="/api/v1/chatbot/webhooks", tags=["webhooks"])

# Signature verification per channel
CHANNEL_SECRETS = {
    "whatsapp": os.getenv("WHATSAPP_WEBHOOK_VERIFY_TOKEN"),
    "facebook": os.getenv("FACEBOOK_WEBHOOK_VERIFY_TOKEN"),
    # etc.
}

def verify_signature(channel: str, body: str, signature: str) -> bool:
    """Verify webhook signature"""
    secret = CHANNEL_SECRETS.get(channel)
    expected = hmac.new(
        secret.encode(),
        body.encode(),
        hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(signature, expected)

@router.post("/{channel_type}")
async def handle_channel_webhook(
    channel_type: str,
    request: Request,
    background_tasks: BackgroundTasks
):
    """Universal webhook for all messaging channels"""
    body = await request.json()
    signature = request.headers.get("X-Hub-Signature-256", "")
    
    # 1. Verify signature
    if not verify_signature(channel_type, str(body), signature):
        return {"error": "Invalid signature"}, 403
    
    # 2. Deduplicate (Redis)
    message_id = body.get("id") or body.get("message_id")
    if await redis.exists(f"msg:{channel_type}:{message_id}"):
        return {"status": "duplicate"}  # Already processed
    
    await redis.setex(f"msg:{channel_type}:{message_id}", 86400, "1")
    
    # 3. Queue for background processing
    processor = MessageProcessor()
    background_tasks.add_task(
        processor.process_message,
        channel_type=channel_type,
        payload=body
    )
    
    # 4. Return 200 immediately (webhook timeout)
    return {"status": "accepted"}

@router.get("/{channel_type}")
async def verify_webhook(channel_type: str, request: Request):
    """Webhook verification challenge (Facebook, WhatsApp)"""
    token = request.query_params.get("hub.verify_token")
    challenge = request.query_params.get("hub.challenge")
    
    if token == CHANNEL_SECRETS.get(channel_type):
        return int(challenge)  # Return as integer for Facebook
    
    return {"error": "Invalid token"}, 403
```

---

## Part 6: Database Schema Updates Needed

### Step 6.1: Create Provider Credentials Table

```sql
CREATE TABLE provider_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  provider VARCHAR(50) NOT NULL,  -- whatsapp, facebook, sendgrid, twilio
  encrypted_data JSONB NOT NULL,  -- Encrypted credentials
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(workspace_id, provider)
);

CREATE INDEX idx_provider_credentials_workspace 
  ON provider_credentials(workspace_id, provider);
```

### Step 6.2: Create Chatbot Channels Table

```sql
CREATE TABLE chatbot_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  channel_type VARCHAR(50) NOT NULL,  -- whatsapp, facebook, web, phone
  name VARCHAR(255) NOT NULL,
  is_public BOOLEAN DEFAULT FALSE,
  config JSONB NOT NULL,  -- Channel-specific config
  knowledge_source_ids UUID[] DEFAULT ARRAY[]::UUID[],
  system_prompt TEXT,
  model VARCHAR(100) DEFAULT 'gpt-4o-mini',
  temperature FLOAT DEFAULT 0.7,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);

CREATE INDEX idx_chatbot_channels_workspace 
  ON chatbot_channels(workspace_id, deleted_at);
```

### Step 6.3: Create Knowledge Sources Table

```sql
CREATE TABLE knowledge_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(50),  -- document, web, api, sync
  chunk_size INT DEFAULT 512,
  chunk_overlap INT DEFAULT 128,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES knowledge_sources(id),
  workspace_id UUID NOT NULL REFERENCES workspaces(id),
  content TEXT NOT NULL,
  embedding vector(768),  -- pgvector embedding
  source_url TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT valid_chunk_size CHECK (length(content) > 0)
);

CREATE INDEX idx_knowledge_chunks_embedding 
  ON knowledge_chunks 
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
```

---

## Part 7: Environment Variables to Add

**File**: `.env` or `.env.example`

```bash
# ===== WHATSAPP =====
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=

# ===== FACEBOOK MESSENGER =====
FACEBOOK_PAGE_ACCESS_TOKEN=
FACEBOOK_APP_ID=
FACEBOOK_APP_SECRET=
FACEBOOK_WEBHOOK_VERIFY_TOKEN=

# ===== TELEGRAM =====
TELEGRAM_BOT_TOKEN=

# ===== SENDGRID =====
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=support@yourdomain.com

# ===== TWILIO =====
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WEBHOOK_URL=https://your-domain/api/v1/voice/webhooks/twilio

# ===== KNOWLEDGE BASE / EMBEDDINGS =====
EMBEDDING_MODEL=nomic-embed-text  # or openai
OPENAI_API_KEY=  # If using OpenAI embeddings
OLLAMA_BASE_URL=http://ollama:11434
CHUNK_SIZE=512
CHUNK_OVERLAP=128

# ===== WEBHOOK SECURITY =====
WEBHOOK_SIGNING_SECRET=  # Master secret for signing

# ===== ENCRYPTION =====
ENCRYPTION_KEY=  # For encrypting provider credentials (32 chars)
```

---

## Part 8: Rough Cost Breakdown

### Setup Costs (One-time)

| Item | Cost |
|------|------|
| **WhatsApp Business Account Setup** | $0 |
| **Facebook App + Page Setup** | $0 |
| **Telegram Bot Creation** | $0 |
| **Domain SSL Certificate** | $0–15 (Cloudflare, Let's Encrypt) |
| **Development/Testing** | 10–20 hours ($500–1000) |
| **Knowledge Base Initial Upload** | Varies by volume |
| **Total Setup** | **$500–1,000** |

---

### Monthly Recurring Costs

| Service | Volume | Cost |
|---------|--------|------|
| **WhatsApp Cloud API** | 10k msgs | $10–20 |
| **Facebook Messenger** | Unlimited | $0 |
| **Telegram** | Unlimited | $0 |
| **Twilio SMS/Voice** | 1k mins + 100 SMS | $15–30 |
| **SendGrid Email** | 100k emails | $20 |
| **Ollama Embeddings** | Unlimited (local) | $0 |
| **PostgreSQL (Railway)** | Included free tier | $0–5 |
| **Redis (Railway)** | Included free tier | $0 |
| **Vercel** | Frontend hosting | $0–20 |
| **Railway** | API + Workers | $5–20 |
| **Total Monthly (Startup Phase)** | **~$50–100** |

---

### Scaling Costs (as you grow)

| Milestone | Trigger | New Cost |
|-----------|---------|----------|
| **High volume messaging** | >100k WhatsApp msgs | +$50–150 |
| **Large knowledge base** | >10GB embeddings | Upgrade to Pinecone/Weaviate (+$30) |
| **High API traffic** | >1M requests/month | Railway: $20–50 |
| **Database growth** | >1GB PostgreSQL | Supabase Pro: +$25 |
| **Email volume** | >1M emails/month | SendGrid: +$40 |
| **Total at Scale** | **~$200–400/month** |

---

## Part 9: Deployment Checklist

### Phase 1: Core Messaging (Week 1)
- [ ] Create WhatsApp Business Account + get credentials
- [ ] Create Facebook App + Messenger integration
- [ ] Deploy emailVoice with webhook handlers
- [ ] Test incoming messages via playground
- [ ] Set up Redis deduplication + dead-letter queue

### Phase 2: Knowledge Base (Week 2)
- [ ] Create Ollama service in docker-compose
- [ ] Upload initial documentation
- [ ] Test semantic search
- [ ] Link knowledge sources to channels
- [ ] Test augmented prompts

### Phase 3: Email + Voice (Week 2–3)
- [ ] Configure SendGrid API key
- [ ] Set up email templates
- [ ] Provision Twilio phone number
- [ ] Test inbound calls + SMS

### Phase 4: Website Widget (Week 3)
- [ ] Create public web channel
- [ ] Generate embed code
- [ ] Add to website
- [ ] Test end-to-end

### Phase 5: Monitoring + Ops (Week 4)
- [ ] Set up error tracking (Sentry)
- [ ] Create dashboards (webhook queue depth, latency)
- [ ] Set up alerting (failed messages, API errors)
- [ ] Document runbooks (escalation, manual message recovery)

---

## Part 10: Troubleshooting

### Webhook Not Receiving Messages

**Checklist:**
1. Verify webhook URL is publicly accessible: `curl https://your-domain/api/v1/chatbot/webhooks/whatsapp`
2. Check provider webhook settings (Meta, Twilio console)
3. Verify signature verification isn't failing: Check logs for "Invalid signature"
4. Ensure HTTPS (providers require HTTPS)
5. Check firewall/WAF isn't blocking POST requests

### Messages Not Embedding

1. Verify Ollama is running: `curl http://ollama:11434/api/tags`
2. Check pgvector extension enabled: `SELECT * FROM pg_extension WHERE extname='vector'`
3. Monitor embedding service logs
4. Verify EMBEDDING_MODEL environment variable

### Knowledge Base Not Searched

1. Verify channel has knowledge_source_ids set
2. Test search endpoint manually: `POST /api/v1/chatbot/knowledge-sources/search`
3. Check chunk embeddings exist: `SELECT COUNT(*) FROM knowledge_chunks WHERE embedding IS NOT NULL`

---

## Next Steps

1. **Choose integration priority**: WhatsApp → Facebook → Website → Email → Voice
2. **Assign API credential provisioning**: Who manages provider accounts?
3. **Plan knowledge base**: What docs/FAQs to upload first?
4. **Set SLAs**: Acceptable webhook latency, error rates?
5. **Communicate to users**: When each channel goes live

---

## References

- [WhatsApp Cloud API Docs](https://developers.facebook.com/docs/whatsapp/cloud-api/)
- [Facebook Messenger Platform](https://developers.facebook.com/docs/messenger-platform)
- [Telegram Bot API](https://core.telegram.org/bots)
- [SendGrid API Docs](https://docs.sendgrid.com/api-reference)
- [Twilio Voice API](https://www.twilio.com/docs/voice)
- [pgvector Extension](https://github.com/pgvector/pgvector)
- [Ollama Embeddings](https://ollama.ai)

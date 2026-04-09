# 📊 Nieuwe Import Flow - Voorstel

## 🎯 Doel
Gebruikers krijgen controle over ticker mapping bij CSV import met AI-suggesties.

---

## 🔄 Huidige Problemen

1. ❌ **Geen onderscheid** tussen DEGIRO en manual positions
2. ❌ **Geen delete** van geïmporteerde posities mogelijk
3. ❌ **Automatische ticker matching** kan fout zijn
4. ❌ **Beurs/exchange** wordt niet meegenomen
5. ❌ **Geen verkoop functie**

---

## ✅ Nieuwe Flow - Stap voor Stap

### **Stap 1: CSV Upload**
```
Gebruiker → Upload DEGIRO CSV → Parser leest file
```

### **Stap 2: Ticker Matching & Approval Screen**

**Voor elk aandeel uit CSV:**

```
┌─────────────────────────────────────────────────────────────┐
│  📋 Controleer Ticker Mapping (3 aandelen gevonden)        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ✅ ASML HOLDING NV                                          │
│  ISIN: NL0010273215                                         │
│  Beurs: Euronext Amsterdam (AMS)                           │
│                                                             │
│  Gesuggereerde ticker: ASML.AS                             │
│  Confidence: ⭐⭐⭐⭐⭐ (95%)                                   │
│                                                             │
│  [✓ Goedkeuren]  [✏️ Aanpassen]                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚠️ APPLE INC                                                │
│  ISIN: US0378331005                                         │
│  Beurs: NASDAQ (NAS)                                        │
│                                                             │
│  Gesuggereerde ticker: AAPL                                │
│  Confidence: ⭐⭐⭐⭐ (85%)                                     │
│                                                             │
│  ⚠️ Let op: Mogelijk meerdere beurzen                       │
│  Alternatieven: AAPL (NASDAQ), APC.DE (Xetra)              │
│                                                             │
│  [✓ Goedkeuren]  [✏️ Aanpassen]  [🔍 Andere opties]         │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ❌ UNKNOWN STOCK B.V.                                       │
│  ISIN: NL9999999999                                         │
│  Beurs: Onbekend                                            │
│                                                             │
│  ❌ Geen ticker gevonden                                    │
│  Confidence: - (0%)                                         │
│                                                             │
│  📝 Handmatig invoeren vereist                              │
│  Yahoo Symbol: [____________]  [🔍 Zoeken]                  │
│                                                             │
│  [✏️ Handmatig invoeren]  [❌ Overslaan]                     │
└─────────────────────────────────────────────────────────────┘

         [← Terug]          [Importeer 2 van 3 →]
```

### **Stap 3: Bevestiging**
```
✅ Mapping opgeslagen
✅ Transacties geïmporteerd
✅ Posities berekend

→ Dashboard
```

---

## 🔧 Technische Implementatie

### **Database: `ticker_mappings` Table**

```sql
CREATE TABLE ticker_mappings (
  id UUID PRIMARY KEY,
  isin TEXT NOT NULL,
  product_name TEXT NOT NULL,
  exchange TEXT,                    -- AMS, NASDAQ, NYSE, etc.
  suggested_ticker TEXT NOT NULL,   -- ASML, AAPL, etc.
  yahoo_symbol TEXT NOT NULL,       -- ASML.AS, AAPL, etc.
  confidence_score DECIMAL(3,2),    -- 0.00 to 1.00
  is_approved BOOLEAN DEFAULT false,
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  UNIQUE(isin, product_name)
);
```

### **Matching Algorithm**

**Prioriteit:**
1. ✅ **Exact ISIN match** in securities DB → 100% confidence
2. ✅ **Fuzzy name match** + exchange → 70-95% confidence
3. ✅ **Name only** → 50-70% confidence
4. ❌ **No match** → Manual input required

**Exchange Suffix Mapping:**
```javascript
{
  "AMS": ".AS",      // Euronext Amsterdam
  "NASDAQ": "",      // No suffix
  "NYSE": "",        // No suffix  
  "XETRA": ".DE",    // Frankfurt
  "LSE": ".L",       // London
  "EPA": ".PA",      // Paris
  "BIT": ".MI",      // Milan
}
```

---

## 🎨 UI Component Structuur

### **1. TickerMappingReview Component**
```typescript
<TickerMappingReview
  mappings={suggestedMappings}
  onApprove={handleApprove}
  onEdit={handleEdit}
  onSkip={handleSkip}
/>
```

### **2. Confidence Badge**
```typescript
<ConfidenceBadge score={0.95}>
  ⭐⭐⭐⭐⭐ (95%)
</ConfidenceBadge>
```

### **3. Ticker Edit Modal**
```typescript
<TickerEditModal
  isin="NL0010273215"
  currentTicker="ASML.AS"
  onSave={handleSave}
/>
```

---

## 🔄 Import Flow Diagram

```
CSV Upload
    ↓
Parse Transacties
    ↓
Groepeer per ISIN
    ↓
Voor elk uniek aandeel:
    ├─ Check ticker_mappings (approved)
    │   └─ Gevonden → Gebruik approved ticker
    │
    ├─ Search securities DB (ISIN)
    │   └─ Gevonden → Suggest met 95-100%
    │
    ├─ Fuzzy match (name + exchange)
    │   └─ Match → Suggest met 70-90%
    │
    └─ Geen match
        └─ Manual input required
    ↓
Toon Approval Screen
    ↓
Gebruiker approved/edits
    ↓
Save to ticker_mappings (is_approved=true)
    ↓
Import transacties
    ↓
Dashboard
```

---

## 💾 Data Flow

### **Eerste Import:**
```
1. CSV → Parse → Extract ISINs
2. Batch lookup ISINs in securities
3. Generate suggestions
4. Show approval screen
5. User approves
6. Save to ticker_mappings (is_approved=true)
7. Import transactions
```

### **Tweede Import (zelfde aandelen):**
```
1. CSV → Parse → Extract ISINs
2. Check ticker_mappings WHERE is_approved=true
3. Found → Skip approval screen
4. Import direct
```

---

## 🎯 Benefits

✅ **User Control** - Gebruiker ziet en approved elke ticker
✅ **Transparency** - Confidence scores zichtbaar
✅ **Learning System** - Approved mappings worden hergebruikt
✅ **Exchange Aware** - Correcte Yahoo suffix per beurs
✅ **Error Reduction** - Gebruiker kan fouten spotten
✅ **Flexibility** - Manual override mogelijk

---

## 📋 Implementation Checklist

- [ ] Create ticker_mappings table
- [ ] Build matching algorithm
- [ ] Create TickerMappingReview UI
- [ ] Add exchange suffix mapping
- [ ] Implement approval flow
- [ ] Add manual edit modal
- [ ] Store approved mappings
- [ ] Skip approval for known tickers
- [ ] Add confidence visualization
- [ ] Test met diverse ISINs

---

## 🚀 Next Steps

1. **Review dit voorstel**
2. **Feedback/aanpassingen**
3. **Implement database changes**
4. **Build UI components**
5. **Test import flow**

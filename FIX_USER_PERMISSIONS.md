# 🔧 Fix User Permissions - wessel.bennink@simplicate.nl

## ❌ PROBLEEM

**Gebruiker:** wessel.bennink@simplicate.nl  
**Issues:**
- ❌ Kan geen CSV importeren (406 error)
- ❌ Kan geen handmatige aandelen toevoegen
- ❌ Mogelijk geen portfolio aangemaakt

**OORZAAK:** Row Level Security (RLS) policies zijn niet correct ingesteld in Supabase.

---

## ✅ OPLOSSING - Stap voor Stap

### **STAP 1: Open Supabase SQL Editor**

1. Ga naar: https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/sql
2. Log in als admin

---

### **STAP 2: Run Complete Fix Script**

1. **Open het bestand:** `SUPABASE_FIX_COMPLETE.sql`
2. **Selecteer ALLES** (Ctrl+A)
3. **Kopieer** (Ctrl+C)
4. **Plak in SQL Editor** (Ctrl+V)
5. **Klik "Run"** of druk Ctrl+Enter
6. **Wacht tot het klaar is** (groen vinkje)

Dit script doet:
- ✅ Zet RLS aan voor alle tables
- ✅ Maakt correcte policies voor portfolios
- ✅ Maakt correcte policies voor transactions (import!)
- ✅ Maakt correcte policies voor manual_positions (handmatig toevoegen!)
- ✅ Maakt correcte policies voor ticker_mappings
- ✅ Maakt correcte policies voor securities (read-only)
- ✅ Maakt correcte policies voor cash_positions
- ✅ Maakt correcte policies voor profiles

---

### **STAP 3: Verificatie - Check of User Portfolio Heeft**

Run deze query in SQL Editor:

```sql
SELECT 
  u.email,
  p.id as portfolio_id,
  p.name,
  p.created_at
FROM auth.users u
LEFT JOIN portfolios p ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';
```

**Verwacht resultaat:**
```
email                           | portfolio_id | name              | created_at
--------------------------------|--------------|-------------------|-------------
wessel.bennink@simplicate.nl    | 123-abc-...  | Wessel's Portfolio| 2024-...
```

**Als portfolio_id = NULL is:**  
→ De gebruiker heeft GEEN portfolio! Ga naar STAP 4.

**Als portfolio_id bestaat:**  
→ Perfect! Ga naar STAP 5.

---

### **STAP 4: Maak Portfolio aan (indien nodig)**

Als de gebruiker geen portfolio heeft, run:

```sql
-- Get user ID
DO $$
DECLARE
  user_id_var uuid;
  portfolio_id_var uuid;
BEGIN
  -- Find user
  SELECT id INTO user_id_var 
  FROM auth.users 
  WHERE email = 'wessel.bennink@simplicate.nl';
  
  -- Check if user exists
  IF user_id_var IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  
  -- Check if portfolio already exists
  SELECT id INTO portfolio_id_var
  FROM portfolios
  WHERE user_id = user_id_var;
  
  -- Create portfolio if it doesn't exist
  IF portfolio_id_var IS NULL THEN
    INSERT INTO portfolios (user_id, name)
    VALUES (user_id_var, 'My Portfolio')
    RETURNING id INTO portfolio_id_var;
    
    RAISE NOTICE 'Portfolio created with ID: %', portfolio_id_var;
  ELSE
    RAISE NOTICE 'Portfolio already exists with ID: %', portfolio_id_var;
  END IF;
END $$;
```

---

### **STAP 5: Test de Functionaliteit**

**Laat de gebruiker:**

1. **Uitloggen** uit de app
2. **Opnieuw inloggen**
3. **Test CSV import:**
   - Ga naar `/import`
   - Upload een DEGIRO CSV
   - Klik "Importeren"
   - ✅ Moet werken zonder 406 error!

4. **Test handmatig aandeel toevoegen:**
   - Ga naar `/positions` (of waar de handmatige toevoeg functie is)
   - Klik "Aandeel Toevoegen"
   - Vul gegevens in
   - ✅ Moet werken!

---

### **STAP 6: Verificatie Queries (Optional)**

Check hoeveel data de gebruiker heeft:

```sql
-- Count transactions
SELECT COUNT(*) as transaction_count
FROM transactions t
JOIN portfolios p ON t.portfolio_id = p.id
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';

-- Count manual positions
SELECT COUNT(*) as manual_position_count
FROM manual_positions mp
JOIN portfolios p ON mp.portfolio_id = p.id
JOIN auth.users u ON p.user_id = u.id
WHERE u.email = 'wessel.bennink@simplicate.nl';
```

---

## 🔍 **TROUBLESHOOTING**

### **Als het NIET werkt na de fix:**

1. **Check Browser Console:**
   - Open DevTools (F12)
   - Ga naar Console tab
   - Reproduceer de error
   - Zoek naar rode error messages

2. **Check Supabase Logs:**
   - Ga naar: https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/logs/postgres-logs
   - Filter op user email of tijdstip
   - Kijk naar errors

3. **Verify RLS Policies:**
   ```sql
   SELECT tablename, policyname, cmd, roles, qual
   FROM pg_policies
   WHERE tablename = 'manual_positions';
   ```

---

## 📋 **CHECKLIST**

- [ ] SQL fix script gerund
- [ ] Gebruiker heeft portfolio (verified)
- [ ] RLS policies staan aan
- [ ] Gebruiker uitgelogd en opnieuw ingelogd
- [ ] CSV import getest → ✅ Werkt
- [ ] Handmatig toevoegen getest → ✅ Werkt

---

**Als alles werkt:** Perfect! 🎉  
**Als het nog faalt:** Stuur console screenshot + Supabase logs

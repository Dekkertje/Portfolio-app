# 🔧 Import Troubleshooting Guide

## ❌ Probleem: "Failed to load resource: 406 error"

### 🔍 Wat is er gebeurd?

De **406 (Not Acceptable)** error bij het importeren kan verschillende oorzaken hebben:

1. **Database permissies (RLS policies)** - Meest waarschijnlijk
2. **Authenticatie problemen** - Session verlopen
3. **API rate limiting** - Te veel requests
4. **Supabase configuratie** - Verkeerde table permissions

---

## ✅ OPLOSSING - Stap voor Stap

### **Stap 1: Check of je bent ingelogd**

1. Refresh de pagina (F5)
2. Als je wordt uitgelogd → Log opnieuw in
3. Probeer opnieuw te importeren

---

### **Stap 2: Check Browser Console voor details**

1. **Open Developer Tools:**
   - Chrome/Edge: `F12` of `Ctrl+Shift+I`
   - Firefox: `F12`

2. **Ga naar de Console tab**

3. **Probeer opnieuw te importeren**

4. **Let op rode error messages**, bijvoorbeeld:
   ```
   POST /api/ticker-mapping 406 (Not Acceptable)
   Auth error: ...
   RLS policy violation: ...
   ```

5. **Screenshot maken** en doorsturen naar ontwikkelaar

---

### **Stap 3: Database Permissions Fixen (Voor Admin)**

Als je toegang hebt tot Supabase:

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/[PROJECT_ID]/sql
   ```

2. **Run het volgende SQL script:**

```sql
-- Fix ticker_mappings table permissions
ALTER TABLE ticker_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read all ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can read all ticker mappings" 
  ON ticker_mappings FOR SELECT 
  TO authenticated 
  USING (true);

DROP POLICY IF EXISTS "Users can insert their own ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can insert their own ticker mappings" 
  ON ticker_mappings FOR INSERT 
  TO authenticated 
  WITH CHECK (auth.uid() = approved_by OR approved_by IS NULL);

DROP POLICY IF EXISTS "Users can update their own ticker mappings" ON ticker_mappings;
CREATE POLICY "Users can update their own ticker mappings" 
  ON ticker_mappings FOR UPDATE 
  TO authenticated 
  USING (auth.uid() = approved_by OR approved_by IS NULL);

-- Fix securities table permissions (read-only for all authenticated users)
ALTER TABLE securities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read securities" ON securities;
CREATE POLICY "Anyone can read securities" 
  ON securities FOR SELECT 
  TO authenticated 
  USING (true);
```

3. **Klik "Run" of druk `Ctrl+Enter`**

4. **Test de import opnieuw**

---

### **Stap 4: Alternative Import Methode**

Als het nog steeds niet werkt, probeer:

1. **Kleinere batch importeren:**
   - Kopieer alleen de laatste 50 transacties uit je CSV
   - Maak een nieuw bestand
   - Probeer dit te importeren

2. **CSV Format controleren:**
   - Zorg dat de eerste regel headers bevat
   - Gebruik DEGIRO's standaard export format
   - Geen extra kolommen toegevoegd

---

## 📋 **Checklist voor Ontwikkelaar**

Als gebruikers deze error melden:

- [ ] Check Vercel logs: `vercel logs --follow`
- [ ] Check Supabase logs in dashboard
- [ ] Verify RLS policies zijn correct
- [ ] Check of `ticker_mappings` table bestaat
- [ ] Check of `securities` table bestaat en data bevat
- [ ] Test authenticatie in Postman/Insomnia

---

## 🆘 **Nog steeds problemen?**

**Stuur deze informatie:**

1. Screenshot van browser console errors
2. Welke stap van de import faalt? (File upload / Processing / Ticker review)
3. Grootte van het CSV bestand
4. Tijdstip van de error

---

**Fix deployed:** 2026-04-09
**Versie:** 1.1.0

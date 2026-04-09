# 🔧 Fix Instructions - Auth & Permission Issues

## ⚠️ PROBLEEM

Je hebt waarschijnlijk deze problemen:
- ❌ Kan geen aandelen verwijderen
- ❌ Kan geen profielfoto opslaan  
- ❌ Kan geen naam wijzigen
- ❌ CSV upload geeft 406 error

**OORZAAK:** Row Level Security (RLS) policies in Supabase zijn niet correct.

---

## ✅ OPLOSSING - Volg deze stappen EXACT

### Stap 1: Run SQL Fix Script

1. **Open Supabase SQL Editor:**
   ```
   https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/sql
   ```

2. **Kopieer COMPLETE `SUPABASE_FIX_RLS.sql`**
   - Open bestand in repository
   - Ctrl+A (alles selecteren)
   - Ctrl+C (kopiëren)

3. **Plak in SQL Editor**
   - Ctrl+V
   - Klik "Run" of Ctrl+Enter

4. **Check Output**
   - Laatste query toont RLS status
   - Alle tabellen moeten `true` zijn voor rls_enabled

---

### Stap 2: Verify in Supabase Dashboard

#### Check Portfolios Table:
1. Ga naar: https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/editor/28517
2. Klik op `portfolios` table
3. Klik "Policies" tab
4. Moet zien:
   - ✅ Users can view their own portfolios
   - ✅ Users can create their own portfolio
   - ✅ Users can update their own portfolio
   - ✅ Users can delete their own portfolio

#### Check Profiles Table:
1. Klik op `profiles` table
2. Klik "Policies" tab  
3. Moet zien:
   - ✅ Users can view their own profile
   - ✅ Users can update their own profile
   - ✅ Users can insert their own profile

#### Check Manual Positions:
1. Klik op `manual_positions` table
2. Klik "Policies" tab
3. Moet zien:
   - ✅ Users can view manual positions
   - ✅ Users can insert manual positions
   - ✅ Users can update manual positions
   - ✅ Users can delete manual positions

---

### Stap 3: Test Alles

#### Test 1: Profile Update
```
1. Ga naar Settings
2. Wijzig Full Name → "Test Gebruiker"
3. Klik "Opslaan"
4. ✅ Should work (was: error)
```

#### Test 2: Avatar Upload
```
1. Ga naar Settings
2. Upload foto
3. ✅ Should work (was: 400 error)
4. Check: Avatar in sidebar
```

#### Test 3: Delete Manual Position
```
1. Dashboard → Manual position
2. Klik trash icon
3. Bevestig in modal
4. ✅ Should work (was: 401 error)
```

#### Test 4: CSV Upload (andere gebruiker)
```
1. Login als andere gebruiker
2. Upload DEGIRO CSV
3. ✅ Should work (was: 406 error)
4. Check: Transactions imported
```

---

## 🔍 Troubleshooting

### Nog steeds errors?

#### Check 1: RLS is enabled
```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('portfolios', 'profiles', 'manual_positions', 'cash_positions');
```
Alle moeten `true` zijn.

#### Check 2: Policies exist
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('portfolios', 'profiles', 'manual_positions', 'cash_positions')
ORDER BY tablename, policyname;
```
Moet 16 policies zien (4 per table).

#### Check 3: User is authenticated
Open browser console:
```javascript
const { data: { user } } = await supabase.auth.getUser()
console.log(user) // Must show user object
```

---

## 📋 Complete Feature Checklist

Na fix moet ALLES werken:

### Auth & Profile:
- [ ] Email/password login
- [ ] Google OAuth  
- [ ] Profile naam wijzigen
- [ ] Avatar upload

### Manual Positions:
- [ ] Toevoegen (Yahoo search)
- [ ] Verwijderen (confirmation)
- [ ] Prices ophalen bij refresh

### Cash Positions:
- [ ] Toevoegen
- [ ] Verwijderen
- [ ] Edit

### CSV Upload:
- [ ] DEGIRO import werkt voor alle users
- [ ] No 406 errors

### Dashboard:
- [ ] Compound calculator
- [ ] Dark mode charts
- [ ] Privacy blur
- [ ] Sidebar collapse

---

## 🆘 Nog Steeds Problemen?

1. **Check browser console** (F12) voor errors
2. **Check Supabase logs:**
   - https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/logs/explorer
3. **Verify user is logged in:**
   - Settings → moet user info zien
4. **Clear browser cache:**
   - Ctrl+Shift+Del → Clear all

---

## ✅ Success Criteria

Je weet dat het werkt als:
- ✅ Geen 401/403/406 errors in console
- ✅ Avatar upload werkt
- ✅ Naam wijzigen werkt
- ✅ Delete positions werkt
- ✅ CSV upload werkt (andere user)

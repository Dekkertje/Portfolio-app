# 🚀 Complete Setup Guide

## ✅ Stap 1: Supabase Database Setup

### Run SQL Script

1. **Open Supabase SQL Editor**
   - Ga naar: https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/sql

2. **Kopieer HELE inhoud van `SUPABASE_SETUP.sql`**
   - Open het bestand in deze repository
   - Selecteer alles (Ctrl+A)
   - Kopieer (Ctrl+C)

3. **Plak in SQL Editor**
   - Plak de SQL (Ctrl+V)
   - Klik "Run" (of Ctrl+Enter)

4. **Controleer Output**
   - Laatste query toont verificatie
   - Alle 3 items moeten "true" zijn:
     ```
     manual_positions    | true
     cash_positions      | true
     avatars_bucket      | true
     ```

---

## ✅ Stap 2: Google OAuth Setup

### A. Google Cloud Console

1. **Ga naar Google Cloud Console**
   - https://console.cloud.google.com/apis/credentials

2. **Create Credentials → OAuth 2.0 Client ID**

3. **Configuratie:**
   - Application type: **Web application**
   - Name: **Portfolio Tracker**
   
4. **Authorized redirect URIs** (voeg BEIDE toe):
   ```
   https://sfgjlhjegqpdbiubozuk.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback
   ```

5. **Kopieer:**
   - Client ID
   - Client Secret

### B. Supabase Auth Config

1. **Ga naar Supabase Auth Providers**
   - https://supabase.com/dashboard/project/sfgjlhjegqpdbiubozuk/auth/providers

2. **Klik op "Google"**

3. **Enable Google provider** (toggle aan)

4. **Plak credentials:**
   - Client ID: [van stap A5]
   - Client Secret: [van stap A5]

5. **Save**

---

## ✅ Stap 3: Test de Applicatie

### Test Google Login

1. **Ga naar login page**
   - https://portfolio-app-brown.vercel.app/login

2. **Klik "Inloggen met Google"**

3. **Selecteer Google account**

4. **Wordt doorgestuurd naar dashboard** ✅

### Test Avatar Upload

1. **Ga naar Settings**
   - https://portfolio-app-brown.vercel.app/settings

2. **Klik "Upload foto"**

3. **Selecteer afbeelding** (JPG/PNG/GIF)

4. **Avatar verschijnt** in sidebar ✅

### Test Manual Position

1. **Op dashboard, klik "+ Aandeel"**

2. **Zoek:** "AAPL"

3. **Selecteer:** Apple Inc.

4. **Vul in:**
   - Aantal: 10
   - Prijs: €150
   - Datum: vandaag

5. **Klik "Toevoegen"**

6. **Check positions table** - Apple staat erin ✅

### Test Cash Position

1. **Klik "💵 Cash"**

2. **Vul in:**
   - Valuta: EUR
   - Bedrag: 5000
   - Beschrijving: "Spaarrekening"

3. **Klik "Opslaan"**

4. **Groene card verschijnt** bovenaan ✅

### Test Compound Calculator

1. **Scroll naar beneden**

2. **Calculator staat onderaan dashboard**

3. **Wijzig inputs:**
   - Startbedrag: €10,000
   - Maandelijks: €500
   - Rendement: 7%
   - Jaren: 10

4. **Grafiek update live** ✅

---

## 🎯 Features Checklist

Na setup, controleer:

- [x] Google login werkt
- [x] Avatar upload werkt  
- [x] Manual positions toevoegen
- [x] Cash positions toevoegen
- [x] Yahoo Finance search
- [x] Compound calculator
- [x] Dark mode in charts
- [x] Privacy mode blur
- [x] Collapsible sidebar
- [x] Cash position card (groen)
- [x] Edit/Delete cash

---

## 🔧 Troubleshooting

### "Error 400: redirect_uri_mismatch"
- Check Google Console redirect URIs
- Moet exact matchen met Supabase URL

### "Avatar upload failed"
- Check of avatars bucket bestaat in Supabase Storage
- Check RLS policies in Storage settings

### "Manual position not showing"
- Check console voor errors
- Verify manual_positions table bestaat
- Check portfolio_id is correct

### "Cash not showing"
- Run SQL: `SELECT * FROM cash_positions;`
- Check if record is there
- Verify loadCashPositions() is called

---

## 📞 Support

Als er problemen zijn:
1. Check browser console (F12) voor errors
2. Check Supabase logs
3. Verify alle SQL queries succesvol waren

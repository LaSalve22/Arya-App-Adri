# Radar ARYA

Copilote de trading qui fait respecter le plan Douglas M5 et protège les comptes de prop firm.
**Le Radar ne passe jamais d'ordre** : seul ARYA trade. Les seules commandes envoyées aux
terminaux sont `ENABLE`, `DISABLE` et `CLOSE_ALL` (à partir de l'étape 5).

- Cahier des charges : [`SPEC.md`](SPEC.md)
- Décisions prises : [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Plan de trading : [`plan.yaml`](plan.yaml)

## Structure du dépôt

| Dossier | Contenu |
| --- | --- |
| `mql4/` | EA gardien `RadarGuardian.mq4` (un par terminal MT4) |
| `backend/` | Service Python 3.12 : FastAPI, SQLite, APScheduler |
| `web/` | Appli mobile PWA (Jinja + HTMX), servie par le backend |
| `tests/` | Tests pytest |
| `tools/` | Petits scripts de vérification |

## Règles de sécurité

1. Tout se teste sur un compte **démo**. Aucun compte réel avant accord explicite d'Adrien.
2. Aucun mot de passe, identifiant ou secret dans le code ni dans Git : tout va dans `.env`
   (ignoré par Git). Le modèle est `.env.example`.
3. Les règles du plan vivent dans `plan.yaml`, jamais en dur dans le code.

---

## Installation sur le VPS Windows (étape 1)

Toutes les commandes se tapent dans **PowerShell** (menu Démarrer → taper « PowerShell »).

### 1. Python 3.12

1. Télécharger l'installeur « Windows installer (64-bit) » de **Python 3.12** sur
   <https://www.python.org/downloads/windows/>.
2. Au premier écran, **cocher « Add python.exe to PATH »**, puis « Install Now ».
3. Fermer puis rouvrir PowerShell et vérifier :

   ```powershell
   py -3.12 --version
   ```

   Attendu : `Python 3.12.x`.

### 2. Git

1. Télécharger **Git for Windows** sur <https://git-scm.com/download/win> et installer
   avec les options par défaut.
2. Rouvrir PowerShell et vérifier :

   ```powershell
   git --version
   ```

### 3. Tailscale (VPN privé, aucun port ouvert)

1. Installer Tailscale sur le VPS : <https://tailscale.com/download/windows>, puis se connecter.
2. Installer l'appli Tailscale sur le téléphone et se connecter **avec le même compte**.
3. Vérifier que les deux appareils apparaissent sur <https://login.tailscale.com/admin/machines>.

> On ne s'en sert vraiment qu'à l'étape 4 (appli mobile). Aucun port du VPS n'est ouvert sur Internet.

### 4. Récupérer le projet

```powershell
cd $HOME
git clone https://github.com/LaSalve22/Arya-App-Adri.git radar-arya
cd radar-arya
copy .env.example .env
```

Le fichier `.env` reste sur le VPS uniquement : il n'est jamais envoyé sur GitHub.

### 5. Terminaux MT4 démo

On utilise **2 terminaux démo** : FTMO et FxPro, chacun dans son propre dossier d'installation.

Sur **chaque** terminal :

1. Onglet **Historique du compte** (en bas) → clic droit → **Tout l'historique**.
   Sans ça, l'EA gardien ne voit pas les trades clôturés.
2. Noter les **noms exacts** de l'or, du DAX et du Nasdaq dans « Observation du marché »
   (Ctrl+M → clic droit → « Afficher tout »). Exemples possibles : `XAUUSD`, `GOLD`,
   `GER40.cash`, `US100.cash`, `NAS100`… Ils serviront au paramètre `SymbolMap` de l'EA (étape 2).
3. Noter le **dossier commun MT4** : menu *Fichier → Ouvrir le dossier des données*, puis remonter
   de deux niveaux jusqu'à `...\MetaQuotes\Terminal\` : le dossier `Common\Files` s'y trouve.
   C'est généralement `C:\Users\<toi>\AppData\Roaming\MetaQuotes\Terminal\Common\Files`.

---

## Étapes du projet

1. ✅ Préparation (ce README)
2. ⏳ EA gardien en lecture seule (`state.json`)
3. Backend : collecteur + moteur de règles R1–R12
4. Appli mobile en lecture seule
5. Commandes en démo (`DISABLE`, `CLOSE_ALL`, puis `ENABLE`)
6. Observation en démo, puis réel (sur décision d'Adrien uniquement)

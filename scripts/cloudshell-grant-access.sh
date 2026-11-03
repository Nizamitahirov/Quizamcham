#!/usr/bin/env bash
# Quizamcham — Google Cloud Shell-də BİR DƏFƏ işə salın.
# Firebase Admin SDK servis hesabına layihəni tam idarə etmək üçün lazım olan
# rolları verir və lazımi API-ləri aktivləşdirir (Firestore, Rules, Auth).
#
# İstifadə (Cloud Shell, layihə sahibi kimi daxil olmusunuz):
#   bash cloudshell-grant-access.sh
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-birsual}"
SA="firebase-adminsdk-fbsvc@${PROJECT_ID}.iam.gserviceaccount.com"

echo "▶ Layihə: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "▶ API-lər aktivləşdirilir…"
gcloud services enable \
  serviceusage.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  firebase.googleapis.com \
  firestore.googleapis.com \
  firebaserules.googleapis.com \
  identitytoolkit.googleapis.com \
  securetoken.googleapis.com \
  firebasehosting.googleapis.com \
  apikeys.googleapis.com

ROLES=(
  roles/firebase.admin                    # bütün Firebase məhsulları (Rules, Auth, Hosting…)
  roles/datastore.owner                   # Firestore: məlumat + indekslər + baza ayarları
  roles/firebaserules.admin               # Security Rules yazmaq və publish etmək
  roles/firebaseauth.admin                # Auth: provayderlər, istifadəçilər, domenlər
  roles/serviceusage.serviceUsageAdmin    # API-ləri aktivləşdirmək və istifadə etmək
  roles/iam.serviceAccountUser
  roles/serviceusage.apiKeysAdmin
)

echo "▶ Rollar verilir: ${SA}"
for ROLE in "${ROLES[@]}"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA}" --role="${ROLE}" \
    --condition=None --quiet >/dev/null
  echo "   ✓ ${ROLE}"
done

echo
echo "✅ Hazırdır. Rolların tətbiq olunması 1–2 dəqiqə çəkə bilər."
echo "   Yoxlama: gcloud projects get-iam-policy ${PROJECT_ID} --flatten='bindings[].members' --filter='bindings.members:${SA}' --format='value(bindings.role)'"

# Update Vercel VAPID environment variables
$publicKey = "BFGPQ2vw9KnIdoR9qe09-jMRsAkujgIRfBY6GOQ4qxdfEgmn-w6VKUx7NXQU43XUQA2FZjBIz6OI5pr6r7GkVKQ"
$privateKey = "cAGuwYJdr0lW3RpQTJx1l-_lqdfZU0dtN-XERpZL9c4"

Write-Host "Setting VITE_VAPID_PUBLIC_KEY..."
echo "N" | vercel env add VITE_VAPID_PUBLIC_KEY $publicKey

Write-Host "Setting VAPID_PRIVATE_KEY..."
echo "Y" | vercel env add VAPID_PRIVATE_KEY $privateKey

Write-Host "VAPID keys updated in Vercel!"
Write-Host "Public Key: $publicKey"
Write-Host "Private Key: $privateKey"

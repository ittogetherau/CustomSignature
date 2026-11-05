// The same Exchange changes the automatic setup makes, as a PowerShell script an admin can run
// themselves (fallback if the automatic route fails, or for an emergency removal).
// Names must match api/_lib/exchange.ts NAMES.

export const RELAY_NAMES = {
  inbound: 'Inkwell - from signature relay',
  outbound: 'Inkwell - to signature relay',
  rule: 'Inkwell - route mail for signatures',
} as const

export function setupScript(host: string) {
  return `# Inkwell server-side signatures — manual setup
# 1. In the Microsoft 365 admin center, Settings > Domains, add and verify the domain:
#      ${host}
#    (Inkwell publishes the TXT record for you; ask us for the value if needed.)
# 2. Then run, as an Exchange administrator:
Install-Module ExchangeOnlineManagement -Scope CurrentUser   # once
Connect-ExchangeOnline

New-InboundConnector -Name "${RELAY_NAMES.inbound}" -ConnectorType OnPremises -SenderDomains * \`
  -RequireTls $true -RestrictDomainsToCertificate $true -TlsSenderCertificateName "${host}" -CloudServicesMailEnabled $true

New-OutboundConnector -Name "${RELAY_NAMES.outbound}" -ConnectorType OnPremises -IsTransportRuleScoped $true \`
  -UseMXRecord $false -SmartHosts "${host}" -TlsSettings DomainValidation -TlsDomain "${host}" -CloudServicesMailEnabled $true

New-TransportRule -Name "${RELAY_NAMES.rule}" -Priority 0 -FromScope InOrganization \`
  -RouteMessageOutboundConnector "${RELAY_NAMES.outbound}" \`
  -ExceptIfHeaderContainsMessageHeader "X-Inkwell-Signed" -ExceptIfHeaderContainsWords "1" -StopRuleProcessing $true
`
}

export function removeScript(host?: string) {
  return `# Inkwell server-side signatures — remove (mail goes straight out again immediately)
Connect-ExchangeOnline
Remove-TransportRule -Identity "${RELAY_NAMES.rule}" -Confirm:$false
Remove-OutboundConnector -Identity "${RELAY_NAMES.outbound}" -Confirm:$false
Remove-InboundConnector -Identity "${RELAY_NAMES.inbound}" -Confirm:$false
${host ? `# Optional: remove ${host} in Microsoft 365 admin center > Settings > Domains` : ''}
`
}

export const CLIENT_LABEL: Record<string, string> = {
  'outlook-desktop': 'Outlook for Windows',
  'outlook-mac': 'Outlook for Mac',
  'outlook-mobile': 'Outlook mobile',
  'apple-mail': 'Apple Mail / iPhone',
  gmail: 'Gmail',
  thunderbird: 'Thunderbird',
  other: 'Outlook on the web / other',
}

param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Args
)

node scripts/clean.mjs @Args

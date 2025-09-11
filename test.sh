#!/bin/bash

adr="addr_test1qqa4ymsrgg4gpq3x243tuuetsdze6atmmzzvmlq6nwvjet42y02mmgq55nqrpnsa2a4uxlujrw5lml9extlkd8ccwyps7fe34e"
stake="stake_test1uz4z84da5q22fspsecw4w67r07fph20aljun9lmxnuv8zqc9rd2ed"

curl -H "project_id: preprodUCRP6WTpWi0DXWZF4eduE2VZPod9CjAJ" "https://cardano-preprod.blockfrost.io/api/v0/accounts/${stake}"
curl -H "project_id: preprodUCRP6WTpWi0DXWZF4eduE2VZPod9CjAJ" "https://cardano-preprod.blockfrost.io/api/v0/accounts/${stake}/addresses"

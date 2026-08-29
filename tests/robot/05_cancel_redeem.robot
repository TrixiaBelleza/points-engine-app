*** Settings ***
Documentation     Cancel a redemption and check totals when ENABLE_CANCEL_REDEEM is on.
...               Skips when the instance flag is false. Does not check next expiration.
Resource          resources/common.resource
Suite Setup       Require Cancel Redeem Then Open App
Suite Teardown    Close All Browsers

*** Test Cases ***
Create cancel redeem activities and validate totals
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Create Earn Activity    200    robot-earn-before-redeem
    Redeem Points    50    robot-redeem-to-cancel
    History Should Contain Type And Points    Redeem    -50
    Cancel First Redeem Fully
    History Should Contain Type And Points    Cancel redeem    50
    History Should Contain Type And Points    Redeem    -50
    Should Show Member Totals    available=200    earned=200    redeemed=50    cancel_redeem=50

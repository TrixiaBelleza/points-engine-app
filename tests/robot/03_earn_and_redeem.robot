*** Settings ***
Documentation     Create earn and redeem activities and check history, totals, and next expiration.
Resource          resources/common.resource
Suite Setup       Open App And Login
Suite Teardown    Close All Browsers

*** Test Cases ***
Create earn and redeem activities and validate totals and next expiring points
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Create Earn Activity    200    robot-earn-200
    History Should Contain Type And Points    Earn    200
    Redeem Points    80    robot-redeem-80
    History Should Contain Type And Points    Redeem    -80
    History Should Contain Type And Points    Earn    200
    Should Show Member Totals    available=120    earned=200    redeemed=80
    Should Show Next Expiration For    120

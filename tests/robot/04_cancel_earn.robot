*** Settings ***
Documentation     Cancel an earn and check totals when ENABLE_CANCEL_EARN is on.
...               Skips when the instance flag is false. Does not check next expiration.
Resource          resources/common.resource
Suite Setup       Require Cancel Earn Then Open App
Suite Teardown    Close All Browsers

*** Test Cases ***
Create cancel earn activities and validate totals
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Create Earn Activity    200    robot-earn-to-cancel
    History Should Contain Type And Points    Earn    200
    Cancel First Earn Fully
    History Should Contain Type And Points    Cancel    -200
    History Should Contain Type And Points    Earn    200
    Should Show Member Totals    available=0    earned=200    cancelled=200

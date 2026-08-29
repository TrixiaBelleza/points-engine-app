*** Settings ***
Documentation     Create earn activities and check history, all-time totals, and next expiration.
Resource          resources/common.resource
Suite Setup       Open App And Login
Suite Teardown    Close All Browsers

*** Test Cases ***
Create earn activities and validate totals and next expiring points
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Create Earn Activity    100    robot-earn-100
    History Should Contain Type And Points    Earn    100
    Create Earn Activity    50    robot-earn-50
    History Should Contain Type And Points    Earn    50
    History Should Contain Type And Points    Earn    100
    Should Show Member Totals    available=150    earned=150
    Should Show Next Expiration For    150

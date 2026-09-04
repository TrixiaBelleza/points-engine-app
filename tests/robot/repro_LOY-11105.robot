*** Settings ***
Documentation     LOY-11105: after a partial earn cancellation, next-expiration
...               copy must use the remaining lot amount, not the original earn.
...               This is the expected business behavior. The suite fails while
...               expire/next-expiration still uses the pre-cancel amount.
Resource          resources/common.resource
Suite Setup       Require Cancel Earn Then Open App
Suite Teardown    Close All Browsers

*** Test Cases ***
Partial cancel earn should reduce next expiration amount
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Create Earn Activity    1000    robot-earn-partial-cancel
    History Should Contain Type And Points    Earn    1000
    Cancel First Earn Partially    400
    History Should Contain Type And Points    Cancel    -400
    History Should Contain Type And Points    Earn    1000
    Should Show Member Totals    available=600    earned=1000    cancelled=400
    Should Show Next Expiration For    600

*** Keywords ***
Cancel First Earn Partially
    [Arguments]    ${amount}
    ${cancel}=    Set Variable    xpath=(//tr[td[normalize-space()='Earn']]//button[normalize-space()='Cancel'])[1]
    Open Modal    ${cancel}    xpath=//h2[normalize-space()='Cancel earn']
    Click Element    xpath=//label[contains(normalize-space(),'Partially cancel')]//input[@type='radio']
    Wait Until Page Contains Element    id=cancel-earn-amount    timeout=10s
    Input Text    id=cancel-earn-amount    ${amount}
    Click Element    xpath=//button[@type='submit' and starts-with(normalize-space(), 'Cancel ')]
    Wait Until Page Does Not Contain Element    xpath=//h2[normalize-space()='Cancel earn']    timeout=20s

*** Settings ***
Documentation     Create a member and confirm it exists in history and the members list.
Resource          resources/common.resource
Suite Setup       Open App And Login
Suite Teardown    Close All Browsers

*** Test Cases ***
Create member and validate it was created
    ${name}=    Unique Member Name
    ${phone}=    Unique Phone
    Create New Member    ${name}    ${phone}
    Page Should Contain Element    xpath=//a[normalize-space()='Points history']
    Page Should Contain Element    xpath=//p[normalize-space()='No history in this period.']
    Go To Members
    Input Text    xpath=//input[@aria-label='Search members']    ${name}
    Wait Until Page Contains Element    xpath=//button[.//span[normalize-space()='${name}']]    timeout=10s
    Click Element    xpath=//button[.//span[normalize-space()='${name}']]
    Wait Until Page Contains Element    xpath=//h1[normalize-space()='${name}']

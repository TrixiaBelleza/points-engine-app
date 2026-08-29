# Shared UI keywords for Points Engine.
# Run: python3 -m pip install -r tests/robot/requirements.txt
#      python3 -m robot --outputdir tests/robot/results tests/robot
# Env: APP_PUBLIC_URL, SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD, ROBOT_HEADLESS (default true)
#
# Locators are element-based on purpose. Next.js inlines page strings into script
# payloads, so text keywords such as Wait Until Page Contains match even when the
# text is not rendered.

*** Settings ***
Library    SeleniumLibrary    timeout=20s
Library    ../libraries/PointsEngine.py
Library    String

*** Variables ***
${BASE_URL}           %{APP_PUBLIC_URL=http://localhost:3000}
${ADMIN_EMAIL}        %{SUPERADMIN_EMAIL=superadmin@points.local}
${ADMIN_PASSWORD}     %{SUPERADMIN_PASSWORD=superadmin123}
${BROWSER}            chrome
${HEADLESS}           %{ROBOT_HEADLESS=true}

${MEMBERS_HEADING}    xpath=//h1[normalize-space()='Members']
${CREATE_MEMBER_BTN}    xpath=//button[normalize-space()='Create member']
${CREATE_ACTIVITY_BTN}    xpath=//button[normalize-space()='Create Activity']
${REDEEM_BTN}         xpath=//button[@type='button' and normalize-space()='Redeem']
${CANCEL_SUBMIT}      xpath=//button[@type='submit' and starts-with(normalize-space(), 'Cancel ')]

*** Keywords ***
Open App
    ${headless}=    Convert To Lower Case    ${HEADLESS}
    ${opts}=    Set Variable    add_argument("--window-size=1400,900"); add_argument("--disable-gpu")
    IF    $headless in ['true', '1', 'yes']
        ${opts}=    Catenate    SEPARATOR=${SPACE}    ${opts}; add_argument("--headless=new")
    END
    Open Browser    ${BASE_URL}/login    ${BROWSER}    options=${opts}
    Set Selenium Speed    0.05s

Open App And Login
    Open App
    Sign In As Admin

Require Cancel Earn Then Open App
    Require Cancel Earn    ${BASE_URL}
    Open App And Login

Require Cancel Redeem Then Open App
    Require Cancel Redeem    ${BASE_URL}
    Open App And Login

Sign In As Admin
    Go To    ${BASE_URL}/login
    Wait Until Page Contains Element    id=email
    Wait Until Interactive    xpath=//button[@type='submit' and normalize-space()='Sign in']
    Input Text    id=email    ${ADMIN_EMAIL}
    Input Password    id=password    ${ADMIN_PASSWORD}
    Click Element    xpath=//button[@type='submit' and normalize-space()='Sign in']
    Wait Until Location Contains    /members    timeout=20s
    Wait Until Page Contains Element    ${MEMBERS_HEADING}    timeout=20s

Go To Members
    Go To    ${BASE_URL}/members
    Wait Until Page Contains Element    ${MEMBERS_HEADING}    timeout=20s

Wait Until Interactive
    [Documentation]    React drops clicks that land before hydration, so wait for the
    ...    handlers to be attached instead of relying on the element being present.
    [Arguments]    ${locator}
    Wait Until Element Is Enabled    ${locator}    timeout=30s
    Wait Until Keyword Succeeds    30x    1s    Element Should Be Hydrated    ${locator}

Element Should Be Hydrated
    [Arguments]    ${locator}
    ${element}=    Get WebElement    ${locator}
    ${hydrated}=    Execute Javascript    ARGUMENTS    ${element}    JAVASCRIPT
    ...    return Object.keys(arguments[0]).some((k) => k.startsWith('__reactProps$') || k.startsWith('__reactFiber$'));
    Should Be True    ${hydrated}    Element ${locator} is not hydrated yet.

Open Modal
    [Arguments]    ${button}    ${modal_element}
    Wait Until Interactive    ${button}
    Wait Until Keyword Succeeds    5x    2s    Click And Expect    ${button}    ${modal_element}

Click And Expect
    [Arguments]    ${button}    ${modal_element}
    Click Element    ${button}
    Wait Until Page Contains Element    ${modal_element}    timeout=5s

Create New Member
    [Arguments]    ${name}    ${phone}
    Go To Members
    Open Modal    ${CREATE_MEMBER_BTN}    id=full-name
    Input Text    id=full-name    ${name}
    Input Text    id=contact    ${phone}
    Click Element    xpath=//button[@type='submit' and normalize-space()='Create']
    Wait Until Page Contains Element    xpath=//h1[normalize-space()='${name}']    timeout=20s
    Wait For Available Balance    0

Create Earn Activity
    [Arguments]    ${points}    ${note}=
    Open Modal    ${CREATE_ACTIVITY_BTN}    id=points
    Input Text    id=points    ${points}
    IF    '${note}' != ''
        Input Text    id=note    ${note}
    END
    Click Element    xpath=//button[@type='submit' and normalize-space()='Save']
    Wait Until Page Does Not Contain Element    id=points    timeout=20s

Redeem Points
    [Arguments]    ${amount}    ${note}=
    Open Modal    ${REDEEM_BTN}    id=amount
    Input Text    id=amount    ${amount}
    IF    '${note}' != ''
        Input Text    id=redeem-note    ${note}
    END
    Click Element    xpath=//button[@type='submit' and normalize-space()='Redeem']
    Wait Until Page Does Not Contain Element    id=amount    timeout=20s

Cancel First Earn Fully
    ${cancel}=    Set Variable    xpath=(//tr[td[normalize-space()='Earn']]//button[normalize-space()='Cancel'])[1]
    Open Modal    ${cancel}    xpath=//h2[normalize-space()='Cancel earn']
    Click Element    ${CANCEL_SUBMIT}
    Wait Until Page Does Not Contain Element    xpath=//h2[normalize-space()='Cancel earn']    timeout=20s

Cancel First Redeem Fully
    ${cancel}=    Set Variable    xpath=(//tr[td[normalize-space()='Redeem']]//button[normalize-space()='Cancel'])[1]
    Open Modal    ${cancel}    xpath=//h2[normalize-space()='Cancel redeem']
    Click Element    ${CANCEL_SUBMIT}
    Wait Until Page Does Not Contain Element    xpath=//h2[normalize-space()='Cancel redeem']    timeout=20s

Wait For Available Balance
    [Arguments]    ${amount}
    ${label}=    Formatted Points    ${amount}
    Wait Until Page Contains Element    xpath=//p[contains(@class,'tabular-nums') and normalize-space()='${label} available']    timeout=20s

History Should Contain Type And Points
    [Arguments]    ${type}    ${points}
    ${signed}=    Signed Points    ${points}
    Wait Until Page Contains Element    xpath=//tr[td[normalize-space()='${type}'] and td[normalize-space()='${signed}']]    timeout=20s

Should Show Member Totals
    [Arguments]    ${available}    ${earned}    ${redeemed}=0    ${cancelled}=0    ${cancel_redeem}=0    ${expired}=0
    Wait For Available Balance    ${available}
    ${earned_l}=    Formatted Points    ${earned}
    Wait Until Page Contains Element    xpath=//td[normalize-space()='Earned']/following-sibling::td[normalize-space()='${earned_l}']
    ${avail_l}=    Formatted Points    ${available}
    Page Should Contain Element    xpath=//tr[td[normalize-space()='Available'] and td[normalize-space()='${avail_l}']]
    ${redeemed_l}=    Signed Points    -${redeemed}
    Page Should Contain Element    xpath=//td[normalize-space()='Redeemed']/following-sibling::td[normalize-space()='${redeemed_l}']
    IF    ${cancelled} > 0
        ${cancelled_l}=    Signed Points    -${cancelled}
        Page Should Contain Element    xpath=//td[normalize-space()='Cancelled']/following-sibling::td[normalize-space()='${cancelled_l}']
    END
    IF    ${cancel_redeem} > 0
        ${cr_l}=    Signed Points    ${cancel_redeem}
        Page Should Contain Element    xpath=//td[normalize-space()='Cancel redeem']/following-sibling::td[normalize-space()='${cr_l}']
    END
    ${expired_l}=    Signed Points    -${expired}
    Page Should Contain Element    xpath=//td[normalize-space()='Expired']/following-sibling::td[normalize-space()='${expired_l}']

Should Show Next Expiration For
    [Arguments]    ${points}
    ${copy}=    Next Expiration Copy    ${points}    ${BASE_URL}
    Wait Until Page Contains Element    xpath=//p[normalize-space()='${copy}']    timeout=20s

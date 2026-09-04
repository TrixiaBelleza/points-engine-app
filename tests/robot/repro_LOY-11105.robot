*** Settings ***
Documentation    Regression test for LOY-11105: Partial earn cancellation expiration bug
...
...    After a partial earn cancellation, expiration preview and posted expire amounts
...    incorrectly use the pre-cancel remaining balance instead of the reduced remaining amount.
Library    SeleniumLibrary
Resource    resources/common.resource

Test Cases
    Test Partial Earn Cancellation Expiration Bug
        [Documentation]    Verify that next expiration shows correct remaining balance after partial cancel
        ...    Should show 600 points (remaining after partial cancel) not 1000 (original earn)
        
        # Setup: Create member
        ${member_id}=    Create Member
        
        # Setup: Earn 1000 points
        ${earn_row_id}=    Create Earn Activity    ${member_id}    1000    1000
        
        # Setup: Partially cancel 400 points
        ${cancel_row_id}=    Cancel Earn    ${earn_row_id}    400
        
        # Verify: Next expiration should show 600 points (remaining after partial cancel)
        # Not 1000 points (original earn amount)
        ${next_expiration}=    Get Next Expiration For Member    ${member_id}
        Should Be Equal As Numbers    ${next_expiration}    600
        
        # Cleanup
        Delete Member    ${member_id}
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
use crate::error::ErrorCode;

use crate::state::contest::{Contest, ContestStatus};

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct SendBatch<'info> {

    /// CHECK: This is the contest creator and has authority to send batch rewards.
    #[account(mut)]
    pub creator: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        constraint = contest.status == ContestStatus::AnswerKeyPosted @ErrorCode::ContestNotAnswerKeyPosted,
        constraint = contest.answer_key != 0
            @ ErrorCode::AnswerKeyNotSet,
        has_one = creator
    )]
    pub contest: Box<Account<'info, Contest>>,

    #[account(
        mut,
        seeds = [
            b"vault",
            contest_id.to_le_bytes().as_ref()
        ],
        bump = contest.vault_bump
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"vault_authority", &contest_id.to_le_bytes()],
        bump = contest.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub pool_mint: InterfaceAccount<'info, Mint>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler<'a, 'b, 'c, 'info>(
    ctx: Context<'a, 'b, 'c, 'info, SendBatch<'info>>, 
    contest_id: u64,
    winners: Vec<Pubkey>,
    amounts: Vec<u64>
) -> Result<()> {

    require!(winners.len() == amounts.len(), ErrorCode::InvalidWinnerCount);
    require!(
        !winners.is_empty(),
        ErrorCode::EmptyBatch
    );
    
    let contest = &mut ctx.accounts.contest;
    require!(
        contest.contest_id == contest_id,
        ErrorCode::InvalidContestId
    );

    // Validate all participants first
    for (i, winner) in winners.iter().enumerate() {
        let aact = &ctx.remaining_accounts[i];
        let expected = Pubkey::find_program_address(
            &[  
                b"participant".as_ref(), 
                &contest.contest_id.to_le_bytes(), 
                winner.as_ref()
            ],
            ctx.program_id
        ).0;
        require!(
            aact.key() == expected,
            ErrorCode::InvalidParticipant
        );
    }

    let ata_start = winners.len();
    let mut total_paid: u64 = 0;
    
    // Process each transfer
    for (i, amount) in amounts.into_iter().enumerate() {
        // Get the token account to transfer to
        let ata_info = &ctx.remaining_accounts[ata_start + i];

        let cpi_accounts = TransferChecked {
            from: ctx.accounts.vault.to_account_info(),
            mint: ctx.accounts.pool_mint.to_account_info(),
            to: ata_info.to_account_info(), 
            authority: ctx.accounts.vault_authority.to_account_info(),
        };

        let contest_id_bytes = contest.contest_id.to_le_bytes();
        let vault_authority_bump_bytes = &[contest.vault_authority_bump];

        let signer_seeds: &[&[&[u8]]] = &[&[
            b"vault_authority",
            &contest_id_bytes,
            vault_authority_bump_bytes,
        ]];

        token_interface::transfer_checked(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                cpi_accounts,
                signer_seeds,
            ),
            amount,
            ctx.accounts.pool_mint.decimals,
        )?;
        
        total_paid = total_paid.checked_add(amount).ok_or(ErrorCode::NumericalOverflow)?;
    }
    
    contest.paid_so_far = contest.paid_so_far.checked_add(total_paid).ok_or(ErrorCode::NumericalOverflow)?;
    Ok(())
}
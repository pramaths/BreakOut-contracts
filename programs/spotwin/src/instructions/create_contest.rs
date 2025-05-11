use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::state::contest::{Contest, ContestStatus};

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct CreateContest<'info> {
    #[account(mut)]
    pub creator: Signer<'info>,

    #[account(
        init,
        payer = creator,
        space = Contest::LEN,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump
    )]
    pub contest: Box<Account<'info, Contest>>,

    #[account(
        init,
        payer = creator,
        token::mint = pool_mint,
        token::authority = vault_authority,
        seeds = [b"vault", contest_id.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, TokenAccount>>,


    /// CHECK: This is the vault PDA authority, derived from contest_id. Seeds constraint ensures correctness.
    #[account(
        seeds = [b"vault_authority", &contest_id.to_le_bytes()],
        bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    pub pool_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(
    ctx: Context<CreateContest>,
    contest_id: u64,
    entry_fee: u64,
    lock_slot: u64,
) -> Result<()> {
    let contest = &mut ctx.accounts.contest;
    contest.creator = ctx.accounts.creator.key();
    contest.contest_id = contest_id;
    contest.pool_mint = ctx.accounts.pool_mint.key();
    contest.entry_fee = entry_fee;
    contest.lock_slot = lock_slot;
    contest.status = ContestStatus::Open;
    contest.answer_key = 0;
    contest.payout_root = [0u8; 32];
    contest.winner_count = 0;
    contest.paid_so_far = 0;
    contest.contest_bump = ctx.bumps.contest;
    contest.vault_bump = ctx.bumps.vault; 
    contest.vault_authority_bump = ctx.bumps.vault_authority;
     
    contest.total_entries = 0;

    Ok(())
}

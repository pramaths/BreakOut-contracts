use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount};

use crate::error::ErrorCode;
use crate::state::contest::{Contest, ContestStatus};
use crate::state::participant::Participant;

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct JoinContest<'info> {
    #[account(mut)]
    pub player: Signer<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        has_one = pool_mint,
        constraint = contest.status == ContestStatus::Open @ErrorCode::ContestClosed,
    )]
    pub contest: Box<Account<'info, Contest>>,
 
    #[account(
     init,
     payer = player,
     space = Participant::LEN,
     seeds = [b"participant".as_ref(), &contest_id.to_le_bytes(), player.key().as_ref()],
     bump
    )]
    pub participant: Box<Account<'info, Participant>>,

    #[account(
        mut,
        seeds = [
            b"vault",
            contest_id.to_le_bytes().as_ref()
        ],
        bump = contest.vault_bump
    )]
    pub vault: Account<'info, TokenAccount>,

    /// CHECK: PDA authority
    #[account(
        seeds = [b"vault_authority", &contest_id.to_le_bytes()],
        bump = contest.vault_authority_bump
    )]
    pub vault_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = player_token.owner == player.key() @ErrorCode::InvalidOwner,
        constraint = player_token.mint == pool_mint.key() @ErrorCode::InvalidMint,
    )]
    pub player_token: Account<'info, TokenAccount>,

    pub pool_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}

#[event]
pub struct Joined {
    pub contest_id: u64,
    pub player:     Pubkey,
    pub slot:       u64,
}

pub fn handler(
    ctx: Context<JoinContest>,
    contest_id: u64,
) -> Result<()> {
    let clock = Clock::get()?;
    let contest = &mut ctx.accounts.contest;

    if contest.entry_fee > 0 {
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.player_token.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.player.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, contest.entry_fee)?;
    }
    let p = &mut ctx.accounts.participant;
    p.player = ctx.accounts.player.key();
    p.attempt_mask = 0;
    p.answer_bits = 0;

    contest.total_entries = contest
        .total_entries
        .checked_add(1)
        .ok_or(ErrorCode::NumericalOverflow)?;

    emit!(Joined {
        contest_id,
        player: p.player,
        slot: clock.slot,
    });
    Ok(())
}
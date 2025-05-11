use anchor_lang::prelude::*;
use crate::error::ErrorCode;

use crate::state::contest::{Contest, ContestStatus};

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct PostPayoutRoot<'info> {
    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        constraint = contest.status == ContestStatus::Locked
            @ ErrorCode::ContestNotLocked,
        constraint = contest.answer_key != 0
            @ ErrorCode::AnswerKeyNotSet,
        has_one = creator
    )]
    pub contest: Box<Account<'info, Contest>>,
}

pub fn handler(
    ctx: Context<PostPayoutRoot>,
    _contest_id: u64,
    root: [u8; 32],
    winner_count: u32,
) -> Result<()> {
    let c = &mut ctx.accounts.contest;

    require!(winner_count > 0 && winner_count <= c.total_entries, ErrorCode::InvalidWinnerCount);

    c.payout_root  = root;
    c.winner_count = winner_count;

    Ok(())
}
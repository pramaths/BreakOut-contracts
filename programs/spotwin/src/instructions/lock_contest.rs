use anchor_lang::prelude::*;
use crate::error::ErrorCode;

use crate::state::contest::{Contest, ContestStatus};

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct LockContest<'info> {

    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        constraint = contest.status == ContestStatus::Open @ErrorCode::ContestClosed,
        has_one = creator
    )]
    pub contest: Box<Account<'info, Contest>>,
}

pub fn handler(ctx: Context<LockContest>, _contest_id: u64) -> Result<()> {
    let contest = &mut ctx.accounts.contest;
    contest.status = ContestStatus::Locked;
    Ok(())
}

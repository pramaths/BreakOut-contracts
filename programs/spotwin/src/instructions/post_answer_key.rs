use anchor_lang::prelude::*;
use crate::error::ErrorCode;

use crate::state::contest::{Contest, ContestStatus};

#[derive(Accounts)]
#[instruction(contest_id: u64)]
pub struct PostAnswerKey<'info> {

    pub creator: Signer<'info>,

    #[account(
        mut,
        seeds = [b"contest", &contest_id.to_le_bytes()[..]],
        bump = contest.contest_bump,
        constraint = contest.status == ContestStatus::Locked @ErrorCode::ContestNotLocked,
        has_one = creator
    )]
    pub contest: Box<Account<'info, Contest>>,
}

pub fn handler(
    ctx: Context<PostAnswerKey>,
    _contest_id: u64,
    answer_key: u16,
) -> Result<()> {
    
    let contest = &mut ctx.accounts.contest;
    require!(
        answer_key < (1 << 12),
        ErrorCode::InvalidAnswerKey
    );

    contest.answer_key = answer_key;
    contest.status = ContestStatus::AnswerKeyPosted;
    Ok(())
}
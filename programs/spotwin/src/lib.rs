use anchor_lang::prelude::*;

pub mod state;
pub mod instructions;
pub mod error;

pub use state::*;
pub use instructions::*;
pub use error::*;

declare_id!("HQTPgJCco97ZENMJpUDVQzyStmDTDwPqXB5ZWM8ioUSh");

#[program]
pub mod spotwin {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }

    pub fn create_contest(ctx: Context<CreateContest>, contest_id: u64, entry_fee: u64, lock_slot: u64) -> Result<()> {
        create_contest::handler(ctx, contest_id, entry_fee, lock_slot)
    }

    pub fn join_contest(ctx: Context<JoinContest>, contest_id: u64) -> Result<()> {
        join_contest::handler(ctx, contest_id)
    }

    pub fn update_answers(ctx: Context<UpdateAnswers>, contest_id: u64, new_answer_bits: u16, new_attempt_mask: u16) -> Result<()> {
        update_answers::handler(ctx, contest_id, new_attempt_mask, new_answer_bits)
    }

    pub fn lock_contest(ctx: Context<LockContest>, contest_id: u64) -> Result<()> {
        lock_contest::handler(ctx, contest_id)
    }

    pub fn post_answer_key(ctx: Context<PostAnswerKey>, contest_id: u64, answer_key: u16) -> Result<()> {
        post_answer_key::handler(ctx, contest_id, answer_key)
    }

    pub fn post_payout_root(ctx: Context<PostPayoutRoot>, contest_id: u64, payout_root: [u8; 32], winner_count: u32) -> Result<()> {
        post_payout_root::handler(ctx, contest_id, payout_root, winner_count)
    }

    pub fn send_batch<'a, 'b, 'c, 'info>(
        ctx: Context<'a, 'b, 'c, 'info, SendBatch<'info>>,
        contest_id: u64,
        winners: Vec<Pubkey>,
        amounts: Vec<u64>,
    ) -> Result<()> {
        send_batch::handler(ctx, contest_id, winners, amounts)
    }
    
}

#[derive(Accounts)]
pub struct Initialize {}

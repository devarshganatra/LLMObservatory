import pool from '../db/connection.js';
import { getPaginatedBaselines, countBaselines, getBaselineById } from '../repositories/baselineRepository.js';
import { toBaselineSummaryDTO, toBaselineDetailDTO } from '../api/dto/baseline.dto.js';
import { DatabaseError } from '../errors/AppError.js';

export async function getBaselines({ limit = 10, offset = 0 }) {
    try {
        const [rows, total] = await Promise.all([
            getPaginatedBaselines({ limit, offset }),
            countBaselines()
        ]);

        return {
            data: rows.map(toBaselineSummaryDTO),
            meta: {
                total,
                page: Math.floor(offset / limit) + 1,
                limit
            }
        };
    } catch (err) {
        throw new DatabaseError(`Failed to fetch baselines: ${err.message}`);
    }
}

export async function getBaselineDetail(id) {
    try {
        const baseline = await getBaselineById(id);
        if (!baseline) return null;
        return toBaselineDetailDTO(baseline);
    } catch (err) {
        throw new DatabaseError(`Failed to fetch baseline ${id}: ${err.message}`);
    }
}
